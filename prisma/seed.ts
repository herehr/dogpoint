import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const hashedPassword = await bcrypt.hash('test123', 10)

  await prisma.user.create({
    data: {
      email: 'admin@dogpoint.cz',
      password: hashedPassword,
      role: 'ADMIN',
    },
  })

  console.log('✅ Admin seeded: admin@dogpoint.cz / test123')

  await prisma.animal.create({
    data: {
      name: 'Fluffy',
      species: 'Dog',
      age: 3,
    },
  })

  await prisma.animal.create({
    data: {
      name: 'Whiskers',
      species: 'Cat',
      age: 2,
    },
  })

  console.log('✅ Animals seeded: Fluffy & Whiskers')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })