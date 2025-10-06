// backend/prisma/seed.ts
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding minimal demo animals...')

  // Remove existing animals in dev (optional)
  try { await prisma.animal.deleteMany({}) } catch {}

  // Insert a few simple animals (only fields that are almost always present)
  await prisma.animal.createMany({
    data: [
      { id: 'demo-1', jmeno: 'Rex',  popis: 'Přátelský pes, miluje procházky.', active: true },
      { id: 'demo-2', jmeno: 'Bety', popis: 'Miluje děti a mazlení.',          active: true },
      { id: 'demo-3', jmeno: 'Max',  popis: 'Klidný parťák na gauč.',          active: true },
    ],
    skipDuplicates: true,
  })

  console.log('✅ Seed done')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
