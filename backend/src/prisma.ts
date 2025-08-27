// backend/src/prisma.ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

// (optional) helpful log on hot-reload crashes in dev
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});