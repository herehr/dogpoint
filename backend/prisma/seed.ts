import { PrismaClient } from '@prisma/client';

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

main()
  .then(() => {
    console.log('Seeding complete');
  })
  .catch((e) => {
    console.error(e);
  })
  .finally(() => {
    prisma.$disconnect();
  });