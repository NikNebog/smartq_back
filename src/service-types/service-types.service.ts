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

  async create(data: { name: string; averageDurationMinutes: number; priorityWeight: number }) {
    return this.prisma.serviceType.create({ data });
  }

  async update(id: number, data: any) {
    return this.prisma.serviceType.update({ where: { id }, data });
  }

  async remove(id: number) {
    return this.prisma.serviceType.delete({ where: { id } });
  }
}