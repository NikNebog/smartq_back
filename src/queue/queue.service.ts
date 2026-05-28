import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class QueueService {
  constructor(private prisma: PrismaService) {}

  // Получить текущую очередь по кабинету (с приоритетом)
  async getQueueByRoom(roomId: number) {
    return this.prisma.ticket.findMany({
      where: {
        roomId,
        status: { in: ['waiting', 'called', 'in_service'] },
      },
      include: { serviceType: true },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
    });
  }

  // Пересчитать ETA для всех waiting талонов в кабинете
  async recalculateETA(roomId: number) {
    const waitingTickets = await this.prisma.ticket.findMany({
      where: {
        roomId,
        status: 'waiting',
      },
      include: { serviceType: true },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    // Обновляем ETA для каждого талона
    for (let i = 0; i < waitingTickets.length; i++) {
      const ticket = waitingTickets[i];
      const avgDuration = ticket.serviceType?.averageDurationMinutes ?? 10;
      const etaMinutes = i * avgDuration;

      await this.prisma.ticket.update({
        where: { id: ticket.id },
        data: { etaMinutes },
      });
    }
  }

  // Получить реальное среднее время обслуживания по типу услуги
  async getRealAvgDuration(serviceTypeId: number): Promise<number> {
    const completed = await this.prisma.ticket.findMany({
      where: {
        serviceTypeId,
        status: 'completed',
        serviceStartedAt: { not: null },
        completedAt: { not: null },
      },
      select: { serviceStartedAt: true, completedAt: true },
      take: 20, // берём последние 20 для точности
      orderBy: { completedAt: 'desc' },
    });

    if (completed.length === 0) {
      // Если нет истории — берём из ServiceType
      const serviceType = await this.prisma.serviceType.findUnique({
        where: { id: serviceTypeId },
      });
      return serviceType?.averageDurationMinutes ?? 10;
    }

    const totalMinutes = completed.reduce((sum, t) => {
      const diff = t.completedAt.getTime() - t.serviceStartedAt.getTime();
      return sum + diff / 60000;
    }, 0);

    return Math.round(totalMinutes / completed.length);
  }

  // Получить общую статистику очереди
  async getQueueStats() {
    const rooms = await this.prisma.room.findMany({
      where: { isActive: true },
    });

    const stats = [];

    for (const room of rooms) {
      const activeTickets = await this.prisma.ticket.count({
        where: {
          roomId: room.id,
          status: { in: ['waiting', 'called', 'in_service'] },
        },
      });

      const completedTickets = await this.prisma.ticket.findMany({
        where: {
          roomId: room.id,
          status: 'completed',
          serviceStartedAt: { not: null },
          completedAt: { not: null },
        },
        select: { serviceStartedAt: true, completedAt: true },
      });

      let avgServiceMinutes = 0;
      if (completedTickets.length > 0) {
        const totalMinutes = completedTickets.reduce((sum, t) => {
          const diff = t.completedAt.getTime() - t.serviceStartedAt.getTime();
          return sum + diff / 60000;
        }, 0);
        avgServiceMinutes = Math.round(totalMinutes / completedTickets.length);
      }

      stats.push({
        roomId: room.id,
        roomName: room.name,
        activeTickets,
        avgServiceMinutes,
        etaMinutes: activeTickets * avgServiceMinutes,
      });
    }

    return stats;
  }

  // Получить следующий талон для кабинета (с учётом приоритета)
  async getNextTicket(roomId: number) {
    return this.prisma.ticket.findFirst({
      where: {
        roomId,
        status: 'waiting',
      },
      include: { serviceType: true },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
    });
  }

  // Проверить перегрузку кабинетов
  async checkOverload() {
    const rooms = await this.prisma.room.findMany({
      where: { isActive: true },
    });

    const overloaded = [];

    for (const room of rooms) {
      const queueCount = await this.prisma.ticket.count({
        where: {
          roomId: room.id,
          status: { in: ['waiting', 'called'] },
        },
      });

      if (queueCount > 10) {
        overloaded.push({
          roomId: room.id,
          roomName: room.name,
          queueCount,
        });
      }
    }

    return overloaded;
  }

  // Данные для табло — без авторизации
  async getBoardData() {
    return this.prisma.ticket.findMany({
      where: {
        status: { in: ['called', 'in_service'] },
      },
      include: { room: true, serviceType: true },
      orderBy: { calledAt: 'desc' },
      take: 10,
    });
  }

  // Получить пациентов с высоким приоритетом которые долго ждут
  async getHighPriorityWaiting() {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    return this.prisma.ticket.findMany({
      where: {
        priority: { gte: 4 },
        status: 'waiting',
        createdAt: { lte: tenMinutesAgo },
      },
      include: { serviceType: true, room: true },
      orderBy: { createdAt: 'asc' },
    });
  }
}