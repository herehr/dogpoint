const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

async function main() {
  await prisma.animal.create({
    data: {
      id: uuidv4(),
      name: 'Fluffy',
      age: 3,
      species: 'Dog',
      galerie: {
        create: [
          { id: uuidv4(), url: 'https://dogpoint.fra1.digitaloceanspaces.com/test1.jpg' },
        ],
      },
    },
  });

  console.log('✅ Seed data inserted');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding:', e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });