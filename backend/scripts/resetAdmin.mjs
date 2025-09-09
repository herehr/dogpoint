// backend/scripts/resetAdmin.mjs
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error('Usage: node scripts/resetAdmin.mjs <email> <password>');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);

  // Upsert: create if missing, otherwise promote & reset password
  const user = await prisma.user.upsert({
    where: { email },
    update: { role: 'ADMIN', passwordHash: hash },
    create: { email, role: 'ADMIN', passwordHash: hash },
  });

  console.log('✅ Admin ready:', { id: user.id, email: user.email, role: user.role });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });