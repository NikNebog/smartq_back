import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ServiceTypesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.serviceType.findMany();
  }

  async findOne(id: number) {
    return this.prisma.serviceType.findUnique({ where: { id } });
  }

  async create(data: any) {
  return this.prisma.serviceType.create({
    data: {
      name: data.name,
      averageDurationMinutes: data.averageDurationMinutes ?? 10,
      priorityWeight: data.priorityWeight ?? 1,
      active: data.active ?? true,
    },
  });
}

async update(id: number, data: any) {
  return this.prisma.serviceType.update({
    where: { id },
    data: {
      ...(data.name ? { name: data.name } : {}),
      ...(data.averageDurationMinutes ? { averageDurationMinutes: data.averageDurationMinutes } : {}),
      ...(data.priorityWeight ? { priorityWeight: data.priorityWeight } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
    },
  });
}

async remove(id: number) {
  await this.prisma.roomServiceType.deleteMany({ where: { serviceTypeId: id } });
  await this.prisma.ticket.updateMany({
    where: { serviceTypeId: id },
    data: { serviceTypeId: 1 },
  });
  return this.prisma.serviceType.delete({ where: { id } });
}
}