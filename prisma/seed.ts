import { PrismaClient } from '@prisma/client';

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

await prisma.appSettings.upsert({
  where: { id: 1 },
  update: {},
  create: { appName: 'SmartQ' },
});

  console.log('Seed данные добавлены!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());