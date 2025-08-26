import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs'


const prisma = new PrismaClient();

async function main() {
  await prisma.animal.create({
    data: {
      name: 'Fluffy',
      species: 'Dog',
      age: 3,
    },
  });

  await prisma.animal.create({
    data: {
      name: 'Whiskers',
      species: 'Cat',
      age: 2,
    },
  });
}

   async function main() {
  const hashedPassword = await bcrypt.hash('test123', 10)

  await prisma.user.create({
    data: {
      email: 'admin@dogpoint.cz',
      password: hashedPassword,
      role: 'ADMIN',
    },
  })

  console.log('Admin user created.')
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect())
