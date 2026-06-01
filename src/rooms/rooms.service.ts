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
        isActive: data.isActive,
        serviceTypes: {
          create: data.serviceTypeIds.map((id) => ({ serviceTypeId: id })),
        },
      },
    });
  }

  async update(id: number, data: any) {
  const { serviceTypeIds, active, ...rest } = data;

  if (active !== undefined) {
    rest.isActive = active;
  }

  if (serviceTypeIds !== undefined) {
    await this.prisma.roomServiceType.deleteMany({ where: { roomId: id } });
    return this.prisma.room.update({
      where: { id },
      data: {
        ...rest,
        serviceTypes: {
          create: serviceTypeIds.map((stId: number) => ({ serviceTypeId: stId })),
        },
      },
    });
  }

  return this.prisma.room.update({ where: { id }, data: rest });
}

  async deactivate(id: number) {
    return this.prisma.room.update({ where: { id }, data: { isActive: false } });
  }

  async getQueue(id: number) {
    return this.prisma.ticket.findMany({
      where: { roomId: id, status: 'waiting' },
    });
  }
}