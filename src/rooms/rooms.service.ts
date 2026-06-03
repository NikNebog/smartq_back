import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.room.findMany({
      include: { serviceTypes: { include: { serviceType: true } } },
    });
  }

  async findOne(id: number) {
    return this.prisma.room.findUnique({
      where: { id },
      include: { serviceTypes: { include: { serviceType: true } } },
    });
  }

  async create(data: { name: string; serviceTypeIds: number[]; isActive: boolean }) {
    return this.prisma.room.create({
      data: {
        name: data.name,
        isActive: data.isActive ?? true,
        serviceTypes: {
          create: (data.serviceTypeIds || []).map((id) => ({ serviceTypeId: Number(id) })),
        },
      },
    });
  }

  async update(id: number, data: any) {
    const updateData: any = {};

    if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive);
    if (data.active !== undefined) updateData.isActive = Boolean(data.active);
    if (data.name !== undefined) updateData.name = data.name;

    const rawServices = data.serviceTypeIds || data.services;
    if (Array.isArray(rawServices)) {
      const incomingIds = rawServices.map((sid: any) => Number(sid));
      updateData.serviceTypes = {
        deleteMany: {},
        create: incomingIds.map((sid) => ({ serviceTypeId: sid })),
      };
    }

    return this.prisma.room.update({
      where: { id },
      data: updateData,
      include: { serviceTypes: { include: { serviceType: true } } },
    });
  }

  async deactivate(id: number) {
    const activeTickets = await this.prisma.ticket.count({
      where: {
        roomId: id,
        status: { in: ['waiting', 'called', 'in_service'] },
      },
    });

    if (activeTickets > 0) {
      return this.prisma.room.update({
        where: { id },
        data: { isActive: false },
      });
    }

    await this.prisma.roomServiceType.deleteMany({ where: { roomId: id } });
    return this.prisma.room.delete({ where: { id } });
  }

  async getQueue(id: number) {
    return this.prisma.ticket.findMany({
      where: { roomId: id, status: 'waiting' },
    });
  }
}