import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TicketStatus } from '@prisma/client';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class TicketsService {
  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeGateway,
  ) {}

  private async generateTicketNumber(serviceTypeId: number): Promise<string> {
    const serviceType = await this.prisma.serviceType.findUnique({
      where: { id: serviceTypeId },
    });

    const prefixMap: Record<string, string> = {
      'консультация': 'К',
      'оплата услуг': 'П',
      'рентген': 'Р',
      'лабораторные анализы': 'А',
      'другое': 'О',
      'флюорография': 'Ф',
      'узи': 'У',
      'мрт': 'М',
      'экг': 'Э',
    };

    const name = serviceType?.name?.toLowerCase().trim() ?? '';
    const prefix = prefixMap[name] ?? name.charAt(0).toUpperCase() ?? 'T';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let number: string;
    let attempts = 0;

    do {
      const count = await this.prisma.ticket.count({
        where: { serviceTypeId, createdAt: { gte: today } },
      });

      number = `${prefix}${String(count + 1 + attempts).padStart(3, '0')}`;
      attempts++;

      const exists = await this.prisma.ticket.findFirst({ where: { number } });

      if (!exists) break;
    } while (attempts < 100);

    return number;
  }

  async create(serviceTypeId: number, priority: number = 1, roomId?: number, language?: string) {
    const number = await this.generateTicketNumber(serviceTypeId);

    const waitingTickets = await this.prisma.ticket.count({
      where: { serviceTypeId, status: { in: ['waiting', 'called'] } },
    });

    const serviceType = await this.prisma.serviceType.findUnique({
      where: { id: serviceTypeId },
    });

    const etaMinutes = waitingTickets * (serviceType?.averageDurationMinutes ?? 10);
    const room = await this.resolveCreateRoom(serviceTypeId, roomId);
    const peopleAhead = room
      ? await this.prisma.ticket.count({
          where: {
            roomId: room.id,
            status: { in: ['waiting', 'called', 'in_service', 'redirected'] },
          },
        })
      : 0;

    const ticket = await this.prisma.ticket.create({
      data: {
        number,
        serviceTypeId,
        roomId: room?.id ?? null,
        priority,
        language: language || null,
        status: 'waiting',
        etaMinutes,
      },
      include: { serviceType: true, room: true },
    });

    await this.prisma.queueEvent.create({
      data: {
        ticketId: ticket.id,
        eventType: 'ticket_created',
        newStatus: 'waiting',
        payload: { etaMinutes, roomId: room?.id },
      },
    });

    this.realtime.sendStatusUpdate(ticket.number, 'waiting', room?.name ?? '');

    if (room) {
      const queueCount = await this.prisma.ticket.count({
        where: { roomId: room.id, status: { in: ['waiting', 'called', 'in_service'] } },
      });

      if (queueCount > 10) {
        await this.prisma.queueRecommendation.create({
          data: {
            type: 'overload',
            message: `Кабинет ${room.name} перегружен (${queueCount} человек), рекомендуется перенаправить пациентов`,
            severity: 'critical',
          },
        });
      }
    }

    return {
      ...ticket,
      peopleAhead,
      queuePosition: peopleAhead + 1,
    };
  }

  private async resolveCreateRoom(serviceTypeId: number, roomId?: number) {
    if (Number.isFinite(roomId)) {
      const [requestedRoom] = await this.prisma.$queryRaw<Array<{ id: number; name: string }>>`
        SELECT r."id", r."name"
        FROM "rooms" r
        WHERE r."id" = ${roomId}
          AND r."isActive" = true
          AND COALESCE(r."ticketIssueEnabled", true) = true
          AND EXISTS (
            SELECT 1
            FROM "room_service_types" rst
            WHERE rst."roomId" = r."id"
              AND rst."serviceTypeId" = ${serviceTypeId}
          )
        LIMIT 1
      `;

      if (requestedRoom) {
        return requestedRoom;
      }

      throw new BadRequestException('Выдача талонов в это место обслуживания закрыта или услуга недоступна.');
    }

    return this.smartRouting(serviceTypeId);
  }

  async updateTicket(id: number, data: { roomId?: number; priority?: number; serviceTypeId?: number }) {
    return this.prisma.ticket.update({
      where: { id },
      data: {
        ...(data.roomId ? { roomId: data.roomId } : {}),
        ...(data.priority ? { priority: data.priority } : {}),
        ...(data.serviceTypeId ? { serviceTypeId: data.serviceTypeId } : {}),
      },
      include: { serviceType: true, room: true },
    });
  }

  async arriveTicket(id: number) {
    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: { status: 'waiting' },
      include: { room: true },
    });
    await this.prisma.queueEvent.create({
      data: { ticketId: id, eventType: 'patient_arrived', oldStatus: 'created', newStatus: 'waiting' },
    });
    this.realtime.sendStatusUpdate(ticket.number, 'waiting', ticket.room?.name ?? '');
    return ticket;
  }

  private async smartRouting(serviceTypeId: number) {
    const rooms = await this.prisma.$queryRaw<Array<{ id: number; name: string }>>`
      SELECT r."id", r."name"
      FROM "rooms" r
      WHERE r."isActive" = true
        AND COALESCE(r."ticketIssueEnabled", true) = true
        AND EXISTS (
          SELECT 1
          FROM "room_service_types" rst
          WHERE rst."roomId" = r."id"
            AND rst."serviceTypeId" = ${serviceTypeId}
        )
    `;

    if (rooms.length === 0) return null;

    let bestRoom = rooms[0];
    let minQueue = Infinity;

    for (const room of rooms) {
      const queueCount = await this.prisma.ticket.count({
        where: { roomId: room.id, status: { in: ['waiting', 'called', 'in_service'] } },
      });

      if (queueCount < minQueue) {
        minQueue = queueCount;
        bestRoom = room;
      }
    }

    return bestRoom;
  }

  async findAll(status?: TicketStatus, roomId?: number) {
    return this.prisma.ticket.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(roomId ? { roomId } : {}),
      },
      include: { serviceType: true, room: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    return this.prisma.ticket.findUnique({
      where: { id },
      include: { serviceType: true, room: true, events: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async callTicket(id: number) {
    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: { status: 'called', calledAt: new Date() },
      include: { room: true },
    });
    await this.prisma.queueEvent.create({
      data: { ticketId: id, eventType: 'ticket_called', oldStatus: 'waiting', newStatus: 'called' },
    });
    this.realtime.sendTicketCalled(ticket.number, ticket.room?.name ?? '');
    this.realtime.sendStatusUpdate(ticket.number, 'called', ticket.room?.name ?? '');
    return ticket;
  }

  async startService(id: number) {
    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: { status: 'in_service', serviceStartedAt: new Date() },
      include: { room: true },
    });
    await this.prisma.queueEvent.create({
      data: { ticketId: id, eventType: 'service_started', oldStatus: 'called', newStatus: 'in_service' },
    });
    this.realtime.sendStatusUpdate(ticket.number, 'in_service', ticket.room?.name ?? '');
    return ticket;
  }

  async completeTicket(id: number) {
    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: { status: 'completed', completedAt: new Date() },
      include: { room: true },
    });
    await this.prisma.queueEvent.create({
      data: { ticketId: id, eventType: 'service_completed', oldStatus: 'in_service', newStatus: 'completed' },
    });
    this.realtime.sendStatusUpdate(ticket.number, 'completed', ticket.room?.name ?? '');
    return ticket;
  }

  async cancelTicket(id: number) {
    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: { status: 'cancelled' },
      include: { room: true },
    });
    await this.prisma.queueEvent.create({
      data: { ticketId: id, eventType: 'ticket_cancelled', oldStatus: 'waiting', newStatus: 'cancelled' },
    });
    this.realtime.sendStatusUpdate(ticket.number, 'cancelled', ticket.room?.name ?? '');
    return ticket;
  }

  async noShowTicket(id: number) {
    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: { status: 'no_show' },
      include: { room: true },
    });
    await this.prisma.queueEvent.create({
      data: { ticketId: id, eventType: 'ticket_cancelled', oldStatus: 'called', newStatus: 'no_show' },
    });
    this.realtime.sendStatusUpdate(ticket.number, 'no_show', ticket.room?.name ?? '');
    return ticket;
  }

async returnTicket(id: number) {
  const ticket = await this.prisma.ticket.update({
    where: { id },
    data: { status: 'waiting' },
    include: { room: true },
  });
  await this.prisma.queueEvent.create({
    data: { ticketId: id, eventType: 'patient_arrived', oldStatus: 'no_show', newStatus: 'waiting' },
  });
  this.realtime.sendStatusUpdate(ticket.number, 'waiting', ticket.room?.name ?? '');
  return ticket;
}

  async redirectTicket(id: number, newRoomId: number) {
    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: { status: 'redirected', roomId: newRoomId },
      include: { room: true },
    });
    await this.prisma.queueEvent.create({
      data: { ticketId: id, eventType: 'patient_redirected', oldStatus: 'waiting', newStatus: 'redirected', payload: { newRoomId } },
    });
    this.realtime.sendStatusUpdate(ticket.number, 'redirected', ticket.room?.name ?? '');
    return ticket;
  }
}
