import { PrismaClient } from '@prisma/client';
import type { ServiceType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const serviceTypes = [
    { name: 'consultation', averageDurationMinutes: 15, priorityWeight: 1 },
    { name: 'payment', averageDurationMinutes: 5, priorityWeight: 1 },
    { name: 'xray', averageDurationMinutes: 10, priorityWeight: 2 },
    { name: 'analysis', averageDurationMinutes: 7, priorityWeight: 2 },
    { name: 'other', averageDurationMinutes: 12, priorityWeight: 1 },
  ];

  for (const st of serviceTypes) {
    await prisma.serviceType.upsert({
      where: { name: st.name },
      update: {},
      create: st,
    });
  }

  const allServiceTypes = await prisma.serviceType.findMany();
  const serviceTypeByName = new Map(allServiceTypes.map((serviceType) => [serviceType.name, serviceType]));
  const rooms = [
    { name: 'Кабинет 101', services: ['consultation', 'other'] },
    { name: 'Кабинет 102', services: ['xray'] },
    { name: 'Кабинет 103', services: ['analysis'] },
    { name: 'Касса 1', services: ['payment'] },
  ];

  for (const room of rooms) {
    const savedRoom = await prisma.room.upsert({
      where: { name: room.name },
      update: { isActive: true },
      create: { name: room.name, isActive: true },
    });

    await prisma.roomServiceType.deleteMany({ where: { roomId: savedRoom.id } });
    await prisma.roomServiceType.createMany({
      data: room.services
        .map((name) => serviceTypeByName.get(name))
        .filter((serviceType): serviceType is ServiceType => Boolean(serviceType))
        .map((serviceType) => ({
          roomId: savedRoom.id,
          serviceTypeId: serviceType.id,
        })),
      skipDuplicates: true,
    });
  }

  const consultationRoom = await prisma.room.findUnique({ where: { name: 'Кабинет 101' } });
  const users = [
    { email: 'admin@smartq.test', name: 'Администратор', password: 'admin123', role: 'admin' as const },
    { email: 'manager@smartq.test', name: 'Менеджер очереди', password: 'manager123', role: 'manager' as const },
    {
      email: 'specialist@smartq.test',
      name: 'Специалист',
      password: 'specialist123',
      role: 'specialist' as const,
      roomId: consultationRoom?.id,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        roomId: user.roomId ?? null,
      },
      create: {
        email: user.email,
        name: user.name,
        password: await bcrypt.hash(user.password, 10),
        role: user.role,
        roomId: user.roomId,
      },
    });
  }

  console.log('Seed данные добавлены!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
