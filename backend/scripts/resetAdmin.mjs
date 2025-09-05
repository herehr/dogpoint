// backend/scripts/resetAdmin.mjs
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const [email, password, roleArg] = process.argv.slice(2)
  if (!email || !password) {
    console.error('Usage: npm run reset-admin -- <email> <password> [role]')
    process.exit(1)
  }
  const role = (roleArg || 'ADMIN').toUpperCase()

  const hash = await bcrypt.hash(password, 10)

  // Your schema uses only `passwordHash` (no `password`)
  const user = await prisma.user.upsert({
    where: { email },
    update: { role, passwordHash: hash },
    create: { email, role, passwordHash: hash },
  })

  console.log(`✅ Admin set: ${user.email} (role=${user.role})`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })