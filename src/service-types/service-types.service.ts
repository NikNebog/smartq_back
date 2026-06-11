import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type ServiceTypeRecord = {
  active: boolean;
  averageDurationMinutes: number;
  id: number;
  name: string;
  nameEn: string | null;
  nameKk: string | null;
  priorityWeight: number;
};

@Injectable()
export class ServiceTypesService {
  constructor(private prisma: PrismaService) {}

  private normalizeTranslation(value: unknown): string | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    const text = String(value).trim();

    return text || null;
  }

  private getTranslation(data: any, language: 'kk' | 'en'): string | null | undefined {
    const directKey = language === 'kk' ? 'nameKk' : 'nameEn';

    return this.normalizeTranslation(
      data?.[directKey]
        ?? data?.translations?.[language],
    );
  }

  async findAll() {
    return this.prisma.$queryRaw<ServiceTypeRecord[]>`
      SELECT
        "id",
        "name",
        "nameKk",
        "nameEn",
        "averageDurationMinutes",
        "priorityWeight",
        "active"
      FROM "service_types"
      ORDER BY "id" ASC
    `;
  }

  async findOne(id: number) {
    const [serviceType] = await this.prisma.$queryRaw<ServiceTypeRecord[]>`
      SELECT
        "id",
        "name",
        "nameKk",
        "nameEn",
        "averageDurationMinutes",
        "priorityWeight",
        "active"
      FROM "service_types"
      WHERE "id" = ${id}
      LIMIT 1
    `;

    return serviceType ?? null;
  }

  async create(data: any) {
    const name = String(data.name ?? '').trim();
    const nameKk = this.getTranslation(data, 'kk') ?? null;
    const nameEn = this.getTranslation(data, 'en') ?? null;
    const averageDurationMinutes = Number(data.averageDurationMinutes ?? 10);
    const priorityWeight = Number(data.priorityWeight ?? 1);
    const active = data.active ?? true;

    const [serviceType] = await this.prisma.$queryRaw<ServiceTypeRecord[]>`
      INSERT INTO "service_types" (
        "name",
        "nameKk",
        "nameEn",
        "averageDurationMinutes",
        "priorityWeight",
        "active"
      )
      VALUES (
        ${name},
        ${nameKk},
        ${nameEn},
        ${averageDurationMinutes},
        ${priorityWeight},
        ${active}
      )
      RETURNING
        "id",
        "name",
        "nameKk",
        "nameEn",
        "averageDurationMinutes",
        "priorityWeight",
        "active"
    `;

    return serviceType;
  }

async update(id: number, data: any) {
  const current = await this.findOne(id);

  if (!current) {
    return null;
  }

  const nameKk = this.getTranslation(data, 'kk');
  const nameEn = this.getTranslation(data, 'en');
  const nextName = data.name ? String(data.name).trim() : current.name;
  const nextNameKk = nameKk !== undefined ? nameKk : current.nameKk;
  const nextNameEn = nameEn !== undefined ? nameEn : current.nameEn;
  const nextAverageDurationMinutes = data.averageDurationMinutes
    ? Number(data.averageDurationMinutes)
    : current.averageDurationMinutes;
  const nextPriorityWeight = data.priorityWeight
    ? Number(data.priorityWeight)
    : current.priorityWeight;
  const nextActive = data.active !== undefined ? data.active : current.active;

  const [serviceType] = await this.prisma.$queryRaw<ServiceTypeRecord[]>`
    UPDATE "service_types"
    SET
      "name" = ${nextName},
      "nameKk" = ${nextNameKk},
      "nameEn" = ${nextNameEn},
      "averageDurationMinutes" = ${nextAverageDurationMinutes},
      "priorityWeight" = ${nextPriorityWeight},
      "active" = ${nextActive}
    WHERE "id" = ${id}
    RETURNING
      "id",
      "name",
      "nameKk",
      "nameEn",
      "averageDurationMinutes",
      "priorityWeight",
      "active"
  `;

  return serviceType;
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
