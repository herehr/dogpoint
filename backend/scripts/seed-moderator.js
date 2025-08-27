const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  const email = process.env.SEED_EMAIL || 'moderator@dogpoint.cz';
  const password = process.env.SEED_PASSWORD || 'Test1234!';
  const role = 'MODERATOR';

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.upsert({
      where: { email },
      update: { passwordHash, role },
      create: { email, passwordHash, role },
    });
    console.log(`✅ Seeded ${email} / ${password}`);
  } catch (e) {
    console.error('❌ Seed error:', e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
