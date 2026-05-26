import { Injectable } from '@nestjs/common';
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
  async create(serviceTypeId: number, priority: number = 1) {
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
    const room = await this.smartRouting(serviceTypeId);

    // Создаём талон
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

    // Сохраняем событие
    await this.prisma.queueEvent.create({
      data: {
        ticketId: ticket.id,
        eventType: 'ticket_created',
        newStatus: 'waiting',
        payload: { etaMinutes, roomId: room?.id },
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

    // Считаем очередь по каждому кабинету
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
  async findAll(status?: TicketStatus) {
    return this.prisma.ticket.findMany({
      where: status ? { status } : {},
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

  // Вызвать пациента
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

  // Начать обслуживание
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

  // Завершить обслуживание
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

  // Отменить талон
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

  // Перенаправить талон
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