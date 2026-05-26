import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class QueueService {
  constructor(private prisma: PrismaService) {}

  // Получить текущую очередь по кабинету
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

      // Среднее время обслуживания по кабинету
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

  // Получить следующий талон для кабинета
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

        // Сохраняем событие перегрузки
        await this.prisma.queueEvent.create({
          data: {
            ticketId: 0,
            eventType: 'queue_overloaded',
            payload: { roomId: room.id, queueCount },
          },
        }).catch(() => {}); // игнорируем если ticketId=0 не разрешён
      }
    }

    return overloaded;
  }
}