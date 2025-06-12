import bcrypt from 'bcrypt';
import prisma from '../services/prisma';

async function main() {
  // Seed admin user if not exists
  const adminEmail = 'admin@dogpoint.cz';
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('test123', 10);
    await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        name: 'Admin User',
        role: 'ADMIN',
      },
    });
    console.log(`✅ Created admin user: ${adminEmail}`);
  } else {
    console.log(`ℹ️ Admin user '${adminEmail}' already exists`);
  }

  // Seed animal if not exists
  const animalName = 'Fluffy';
  const existingAnimal = await prisma.animal.findFirst({
    where: { name: animalName },
  });

  if (!existingAnimal) {
    await prisma.animal.create({
      data: {
        name: animalName,
        description: 'A fluffy dog',
        galerie: {
          create: [
            { url: 'https://example.com/photo.jpg', type: 'image' },
            { url: 'https://example.com/video.mp4', type: 'video' },
          ],
        },
      },
    });
    console.log(`✅ Created animal: ${animalName}`);
  } else {
    console.log(`ℹ️ Animal '${animalName}' already exists`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());