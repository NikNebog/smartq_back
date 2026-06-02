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
      include: { doctor: true, room: true, serviceType: true },
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
      include: { doctor: true, room: true, serviceType: true },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
    });

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
      take: 20,
      orderBy: { completedAt: 'desc' },
    });

    if (completed.length === 0) {
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

  // Среднее время от waiting до completed по каждой услуге
  async getAvgTimeByServiceType() {
    const serviceTypes = await this.prisma.serviceType.findMany();
    const result = [];

    for (const serviceType of serviceTypes) {
      const completedTickets = await this.prisma.ticket.findMany({
        where: {
          serviceTypeId: serviceType.id,
          status: 'completed',
          completedAt: { not: null },
        },
        select: {
          createdAt: true,
          completedAt: true,
        },
      });

      let avgMinutes = 0;
      if (completedTickets.length > 0) {
        const totalMinutes = completedTickets.reduce((sum, t) => {
          const diff = t.completedAt.getTime() - t.createdAt.getTime();
          return sum + diff / 60000;
        }, 0);
        avgMinutes = Math.round(totalMinutes / completedTickets.length);
      }

      result.push({
        serviceTypeId: serviceType.id,
        serviceTypeName: serviceType.name,
        avgMinutesFromWaitingToCompleted: avgMinutes,
        totalCompleted: completedTickets.length,
      });
    }

    return result;
  }

  // Аналитика за период (day, week, month, year)
  async getAnalyticsByPeriod(period: string = 'day') {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default: // day
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
    }

    // Общее количество талонов за период
    const totalTickets = await this.prisma.ticket.count({
      where: { createdAt: { gte: startDate } },
    });

    // Завершённые талоны
    const completedTickets = await this.prisma.ticket.count({
      where: {
        createdAt: { gte: startDate },
        status: 'completed',
      },
    });

    // Отменённые талоны
    const cancelledTickets = await this.prisma.ticket.count({
      where: {
        createdAt: { gte: startDate },
        status: 'cancelled',
      },
    });

    // No-show талоны
    const noShowTickets = await this.prisma.ticket.count({
      where: {
        createdAt: { gte: startDate },
        status: 'no_show',
      },
    });

    // Среднее время ожидания (от createdAt до calledAt)
    const calledTickets = await this.prisma.ticket.findMany({
      where: {
        createdAt: { gte: startDate },
        calledAt: { not: null },
      },
      select: { createdAt: true, calledAt: true },
    });

    let avgWaitingMinutes = 0;
    if (calledTickets.length > 0) {
      const total = calledTickets.reduce((sum, t) => {
        return sum + (t.calledAt.getTime() - t.createdAt.getTime()) / 60000;
      }, 0);
      avgWaitingMinutes = Math.round(total / calledTickets.length);
    }

    // Среднее время обслуживания (от serviceStartedAt до completedAt)
    const servedTickets = await this.prisma.ticket.findMany({
      where: {
        createdAt: { gte: startDate },
        status: 'completed',
        serviceStartedAt: { not: null },
        completedAt: { not: null },
      },
      select: { serviceStartedAt: true, completedAt: true },
    });

    let avgServiceMinutes = 0;
    if (servedTickets.length > 0) {
      const total = servedTickets.reduce((sum, t) => {
        return sum + (t.completedAt.getTime() - t.serviceStartedAt.getTime()) / 60000;
      }, 0);
      avgServiceMinutes = Math.round(total / servedTickets.length);
    }

    // Самый частый тип услуги
    const serviceTypeStats = await this.prisma.ticket.groupBy({
      by: ['serviceTypeId'],
      where: { createdAt: { gte: startDate } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 1,
    });

    let mostFrequentService = null;
    if (serviceTypeStats.length > 0) {
      mostFrequentService = await this.prisma.serviceType.findUnique({
        where: { id: serviceTypeStats[0].serviceTypeId },
      });
    }

    // Нагрузка по кабинетам
    const roomStats = await this.prisma.ticket.groupBy({
      by: ['roomId'],
      where: {
        createdAt: { gte: startDate },
        roomId: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    const roomsWithNames = await Promise.all(
      roomStats.map(async (r) => {
        const room = await this.prisma.room.findUnique({ where: { id: r.roomId } });
        return {
          roomId: r.roomId,
          roomName: room?.name ?? 'Неизвестно',
          ticketCount: r._count.id,
        };
      })
    );

    return {
      period,
      startDate,
      totalTickets,
      completedTickets,
      cancelledTickets,
      noShowTickets,
      avgWaitingMinutes,
      avgServiceMinutes,
      mostFrequentService: mostFrequentService?.name ?? null,
      roomStats: roomsWithNames,
    };
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
        etaMinutes: activeTickets * (avgServiceMinutes || 10),
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
      include: { doctor: true, room: true, serviceType: true },
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
        status: { in: ['waiting', 'called', 'in_service'] },
      },
      include: { doctor: true, room: true, serviceType: true },
      orderBy: [
        { calledAt: 'desc' },
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
      take: 20,
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
      include: { doctor: true, serviceType: true, room: true },
      orderBy: { createdAt: 'asc' },
    });
  }
}
