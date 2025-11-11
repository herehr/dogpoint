// backend/scripts/resetAdmin.mjs
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const [email, password, roleArg] = process.argv.slice(2)
  if (!email || !password) {
    console.error('Usage: node scripts/resetAdmin.mjs <email> <password> [role]')
    process.exit(1)
  }
  const role = (roleArg || 'ADMIN').toUpperCase()

  const hash = await bcrypt.hash(password, 10)

  // Be compatible with either `password` or `passwordHash` in your schema
  const data = {
    email,
    role,
    password: hash,
    // @ts-ignore - if your model has passwordHash, this sets it as well
    passwordHash: hash,
  }

  // Create or update admin
  const existing = await prisma.user.findUnique({ where: { email } })
  const user = existing
    ? await prisma.user.update({ where: { email }, data })
    : await prisma.user.create({ data })

  console.log(`✅ Admin set: ${user.email} (role=${user.role})`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })