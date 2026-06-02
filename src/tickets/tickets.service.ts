import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TicketStatus } from '@prisma/client';

@Injectable()
export class TicketsService {
  constructor(private prisma: PrismaService) {}

  // Генерация номера талона A001, A002...
  private async generateTicketNumber(): Promise<string> {
    const count = await this.prisma.ticket.count();
    const number = String(count + 1).padStart(3, '0');
    return `A${number}`;
  }

  // Создать талон
  async create(
    serviceTypeId: number,
    priority: number = 1,
    options: {
      doctorId?: number;
      etaMinutes?: number;
      roomId?: number;
      status?: TicketStatus;
    } = {},
  ) {
    const number = await this.generateTicketNumber();

    // Считаем ETA
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

    // Выбираем кабинет (smart routing)
    const room = options.roomId
      ? await this.prisma.room.findUnique({ where: { id: options.roomId } })
      : await this.smartRouting(serviceTypeId);

    // Создаём талон со статусом created
    const ticket = await this.prisma.ticket.create({
      data: {
        number,
        serviceTypeId,
        roomId: room?.id ?? null,
        doctorId: options.doctorId ?? null,
        priority,
        status: options.status ?? 'created',
        etaMinutes: options.etaMinutes ?? etaMinutes,
      },
      include: { doctor: true, serviceType: true, room: true },
    });

    // Сохраняем событие
    await this.prisma.queueEvent.create({
      data: {
        ticketId: ticket.id,
        eventType: 'ticket_created',
        newStatus: 'created',
        payload: { etaMinutes, roomId: room?.id },
      },
    });

    // Если кабинет перегружен — создаём рекомендацию
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

  // Пациент прибыл — created → waiting
  async arriveTicket(id: number) {
    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: { status: 'waiting' },
      include: { doctor: true, room: true, serviceType: true },
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
        ...(status ? { status } : {}),
        ...(roomId ? { roomId } : {}),
      },
      include: { doctor: true, serviceType: true, room: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Получить один талон
  async findOne(id: number) {
    return this.prisma.ticket.findUnique({
      where: { id },
      include: {
        doctor: true,
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
      include: { doctor: true, room: true, serviceType: true },
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
      include: { doctor: true, room: true, serviceType: true },
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
      include: { doctor: true, room: true, serviceType: true },
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
      include: { doctor: true, room: true, serviceType: true },
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
      include: { doctor: true, room: true, serviceType: true },
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
      data: { status: 'waiting', roomId: newRoomId },
      include: { doctor: true, room: true, serviceType: true },
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

  async updateTicket(
    id: number,
    data: {
      doctorId?: number;
      etaMinutes?: number;
      priority?: number;
      roomId?: number | null;
      serviceTypeId?: number;
      status?: TicketStatus;
    },
  ) {
    const updateData: any = {};

    if (data.serviceTypeId !== undefined) updateData.serviceTypeId = data.serviceTypeId;
    if (data.roomId !== undefined) updateData.roomId = data.roomId;
    if (data.doctorId !== undefined) updateData.doctorId = data.doctorId;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.etaMinutes !== undefined) updateData.etaMinutes = data.etaMinutes;

    if (data.status) {
      updateData.status = data.status;

      if (data.status === 'called') updateData.calledAt = new Date();
      if (data.status === 'in_service') updateData.serviceStartedAt = new Date();
      if (data.status === 'completed') updateData.completedAt = new Date();
      if (data.status === 'waiting') {
        updateData.calledAt = null;
        updateData.serviceStartedAt = null;
        updateData.completedAt = null;
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('Нет данных для обновления талона');
    }

    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: updateData,
      include: { doctor: true, room: true, serviceType: true },
    });

    await this.prisma.queueEvent.create({
      data: {
        ticketId: id,
        eventType: 'patient_redirected',
        newStatus: ticket.status,
        payload: updateData,
      },
    });

    return ticket;
  }
}
