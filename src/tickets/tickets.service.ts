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
        status: { in: ['waiting', 'called'] }
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
        events: { orderBy: { createdAt: 'asc' } }
      },
    });
  }
}