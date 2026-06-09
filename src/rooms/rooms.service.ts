import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlaceType } from '@prisma/client';

const normalizePlaceType = (value?: string): PlaceType => {
  if (!value) return PlaceType.CABINET;

  const normalized = value.trim().toLowerCase();

  if (normalized === 'window' || normalized === 'окно') {
    return PlaceType.WINDOW;
  }

  if (
    normalized === 'table' ||
    normalized === 'desk' ||
    normalized === 'стол'
  ) {
    return PlaceType.TABLE;
  }

  if (
    normalized === 'cabinet' ||
    normalized === 'кабинет'
  ) {
    return PlaceType.CABINET;
  }

  return PlaceType.CABINET;
};

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

 async create(data: {
  name: string | null;
  serviceTypeIds: number[];
  isActive?: boolean;
  placeType?: string;
  workingStartTime?: string;
  workingEndTime?: string;
}) {
  if (!data.name) {
    throw new BadRequestException('Поле name обязательно');
  }

  const existing = await this.prisma.room.findUnique({
    where: { name: data.name },
  });
  if (existing) {
    throw new ConflictException(
      `Кабинет с именем "${data.name}" уже существует`,
    );
  }

  const resolvedPlaceType = normalizePlaceType(data.placeType);

  console.log('=== CREATE SERVICE DATA ===', {
    name: data.name,
    placeType_raw: data.placeType,
    placeType_resolved: resolvedPlaceType,
  });

  const result = await this.prisma.room.create({
    data: {
      name: data.name,
      isActive: data.isActive ?? true,
      placeType: resolvedPlaceType,
      workingStartTime: data.workingStartTime ?? null,
      workingEndTime: data.workingEndTime ?? null,
      serviceTypes: {
        create: (data.serviceTypeIds || []).map((id) => ({
          serviceTypeId: Number(id),
        })),
      },
    },
  });

  console.log('=== CREATE RESULT ===', JSON.stringify(result, null, 2));

  return result;
}

    async update(id: number, data: any) {
    const updateData: any = {};

    if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive);
    if (data.active !== undefined) updateData.isActive = Boolean(data.active);

    const nameRaw = data.name ?? data.title ?? data.roomName;
    if (nameRaw !== undefined) {
      updateData.name = nameRaw?.trim() || null;
    }

    if (data.placeType !== undefined) {
      updateData.placeType = normalizePlaceType(data.placeType);
    }

    const startTime = data.workingStartTime ?? data.workStartTime;
    const endTime = data.workingEndTime ?? data.workEndTime;

    if (startTime !== undefined) {
      updateData.workingStartTime = startTime || null;
    }
    if (endTime !== undefined) {
      updateData.workingEndTime = endTime || null;
    }

    const rawServices = data.serviceTypeIds || data.services;
    if (Array.isArray(rawServices)) {
      const incomingIds = rawServices.map((sid: any) => Number(sid));
      updateData.serviceTypes = {
        deleteMany: {},
        create: incomingIds.map((sid) => ({ serviceTypeId: sid })),
      };
    }

    // --- ВОТ ЭТОТ БЛОК МЫ ИЗМЕНИЛИ ДЛЯ КЛАУДА ---
    const result = await this.prisma.room.update({
      where: { id },
      data: updateData,
      include: { serviceTypes: { include: { serviceType: true } } },
    });

    // Этот лог покажет в консоли, под какими именами данные выходят из базы
    console.log('=== LOG: UPDATE RESULT ===', JSON.stringify(result, null, 2));

    return result;
    // --------------------------------------------
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
