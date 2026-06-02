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

    // 1. Приведение флагов активности к единому полю базы данных isActive
    if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive);
    if (data.active !== undefined) updateData.isActive = Boolean(data.active);

    // 2. Обновление текстового имени
    if (data.name !== undefined) updateData.name = data.name;

    // 3. Безопасная перезапись связей услуг (M2M связь через промежуточную таблицу)
    const rawServices = data.serviceTypeIds || data.services;
    if (Array.isArray(rawServices)) {
      // Превращаем любые строки ID в числа
      const incomingIds = rawServices.map((sid: any) => Number(sid));

      updateData.serviceTypes = {
        // Удаляем все старые привязки услуг к этому кабинету
        deleteMany: {},
        // Создаем новые связи
        create: incomingIds.map((sid) => ({ serviceTypeId: sid })),
      };
    }

    // 4. Выполнение обновления в БД Prisma
    return this.prisma.room.update({
      where: { id },
      data: updateData,
      include: { serviceTypes: { include: { serviceType: true } } },
    });
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