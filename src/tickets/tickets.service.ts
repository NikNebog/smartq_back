import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TicketStatus } from '@prisma/client';

@Injectable()
export class TicketsService {
  constructor(private prisma: PrismaService) {}

  // Генерация номера талона с префиксом по типу услуги
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

    const count = await this.prisma.ticket.count({
      where: {
        serviceTypeId,
        createdAt: { gte: today },
      },
    });

    return `${prefix}${String(count + 1).padStart(3, '0')}`;
  }

  // Создать талон
  async create(serviceTypeId: number, priority: number = 1) {
    const number = await this.generateTicketNumber(serviceTypeId);

    const waitingTickets = await this.prisma.ticket.count({
      where: {
        serviceTypeId,
        status: { in: ['waiting', 'called'] },
      },
    });

    const serviceType = await this.prisma.serviceType.findUnique({
      where: { id: serviceTypeId },
    });

    const etaMinutes = waitingTickets * (serviceType?.averageDurationMinutes ?? 10);

    const room = await this.smartRouting(serviceTypeId);

    const ticket = await this.prisma.ticket.create({
      data: {
        number,
        serviceTypeId,
        roomId: room?.id ?? null,
        priority,
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

    if (room) {
      const queueCount = await this.prisma.ticket.count({
        where: {
          roomId: room.id,
          status: { in: ['waiting', 'called', 'in_service'] },
        },
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

    return ticket;
  }

  // Обновить талон
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

  // Пациент прибыл — created → waiting
  async arriveTicket(id: number) {
    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: { status: 'waiting' },
    });
    await this.prisma.queueEvent.create({
      data: {
        ticketId: id,
        eventType: 'patient_arrived',
        oldStatus: 'created',
        newStatus: 'waiting',
      },
    });
    return ticket;
  }

  // Smart Routing — выбор кабинета с наименьшей очередью
  private async smartRouting(serviceTypeId: number) {
    const rooms = await this.prisma.room.findMany({
      where: {
        isActive: true,
        serviceTypes: {
          some: { serviceTypeId },
        },
      },
    });

    if (rooms.length === 0) return null;

    let bestRoom = rooms[0];
    let minQueue = Infinity;

    for (const room of rooms) {
      const queueCount = await this.prisma.ticket.count({
        where: {
          roomId: room.id,
          status: { in: ['waiting', 'called', 'in_service'] },
        },
      });

      if (queueCount < minQueue) {
        minQueue = queueCount;
        bestRoom = room;
      }
    }

    return bestRoom;
  }

  // Получить все талоны
  async findAll(status?: TicketStatus, roomId?: number) {
    return this.prisma.ticket.findMany({
      where: {
        ...(status ? { status } : {
          status: { in: ['waiting', 'called', 'in_service'] }
        }),
        ...(roomId ? { roomId } : {}),
      },
      include: { serviceType: true, room: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Получить один талон
  async findOne(id: number) {
    return this.prisma.ticket.findUnique({
      where: { id },
      include: {
        serviceType: true,
        room: true,
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  // Вызвать пациента — waiting → called
  async callTicket(id: number) {
    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: { status: 'called', calledAt: new Date() },
    });
    await this.prisma.queueEvent.create({
      data: {
        ticketId: id,
        eventType: 'ticket_called',
        oldStatus: 'waiting',
        newStatus: 'called',
      },
    });
    return ticket;
  }

  // Начать обслуживание — called → in_service
  async startService(id: number) {
    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: { status: 'in_service', serviceStartedAt: new Date() },
    });
    await this.prisma.queueEvent.create({
      data: {
        ticketId: id,
        eventType: 'service_started',
        oldStatus: 'called',
        newStatus: 'in_service',
      },
    });
    return ticket;
  }

  // Завершить обслуживание — in_service → completed
  async completeTicket(id: number) {
    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: { status: 'completed', completedAt: new Date() },
    });
    await this.prisma.queueEvent.create({
      data: {
        ticketId: id,
        eventType: 'service_completed',
        oldStatus: 'in_service',
        newStatus: 'completed',
      },
    });
    return ticket;
  }

  // Отменить талон — any → cancelled
  async cancelTicket(id: number) {
    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: { status: 'cancelled' },
    });
    await this.prisma.queueEvent.create({
      data: {
        ticketId: id,
        eventType: 'ticket_cancelled',
        oldStatus: 'waiting',
        newStatus: 'cancelled',
      },
    });
    return ticket;
  }

  // No-show — called → no_show
  async noShowTicket(id: number) {
    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: { status: 'no_show' },
    });
    await this.prisma.queueEvent.create({
      data: {
        ticketId: id,
        eventType: 'ticket_cancelled',
        oldStatus: 'called',
        newStatus: 'no_show',
      },
    });
    return ticket;
  }

  // Перенаправить талон — any → redirected
  async redirectTicket(id: number, newRoomId: number) {
    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: { status: 'redirected', roomId: newRoomId },
    });
    await this.prisma.queueEvent.create({
      data: {
        ticketId: id,
        eventType: 'patient_redirected',
        oldStatus: 'waiting',
        newStatus: 'redirected',
        payload: { newRoomId },
      },
    });
    return ticket;
  }
}