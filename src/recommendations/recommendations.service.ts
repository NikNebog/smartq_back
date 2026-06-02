import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class RecommendationsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.queueRecommendation.findMany({
      where: { isResolved: false },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolve(id: number) {
    return this.prisma.queueRecommendation.update({
      where: { id },
      data: { isResolved: true },
    });
  }

  @Cron('0 */3 * * * *')
  async checkRules() {
    const rooms = await this.prisma.room.findMany({
      include: {
        tickets: {
          where: { status: { in: ['waiting', 'called', 'in_service'] } },
        },
      },
    });

    for (const room of rooms) {
      if (room.tickets.length > 10) {
        await this.prisma.queueRecommendation.create({
          data: {
            type: 'overload',
            message: `Кабинет ${room.name} перегружен, рекомендуется перенаправить пациентов`,
            severity: 'critical',
          },
        });
      }
    }

    const waitingTickets = await this.prisma.ticket.findMany({
      where: { status: 'waiting' },
      include: { serviceType: true },
    });

    const totalEta = waitingTickets.reduce((acc, t) => {
      return acc + (t.serviceType?.averageDurationMinutes || 12);
    }, 0);

    const avgEta = waitingTickets.length > 0 ? totalEta / waitingTickets.length : 0;

    if (avgEta > 20) {
      await this.prisma.queueRecommendation.create({
        data: {
          type: 'high_wait',
          message: 'Среднее время ожидания превысило 20 минут',
          severity: 'warning',
        },
      });
    }

    const highPriorityTickets = await this.prisma.ticket.findMany({
      where: { status: 'waiting', priority: 5 },
    });

    for (const ticket of highPriorityTickets) {
      const waitMinutes = (Date.now() - ticket.createdAt.getTime()) / 60000;
      if (waitMinutes > 10) {
        await this.prisma.queueRecommendation.create({
          data: {
            type: 'high_priority_wait',
            message: 'Пациент с высоким приоритетом ожидает слишком долго',
            severity: 'critical',
          },
        });
      }
    }
  }
}