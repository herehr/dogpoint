#!/usr/bin/env ts-node
/**
 * Deletes all users except a fixed allow-list (case-insensitive e-mail).
 * Cascades: subscriptions, payments, share invites sent by them, tax profile, etc.
 *
 * Usage (from backend/, with DATABASE_URL in .env):
 *   npx ts-node scripts/cleanup-users-except.ts
 *   npx ts-node scripts/cleanup-users-except.ts --dry-run
 *   npx ts-node scripts/cleanup-users-except.ts --delete-all-subscriptions
 *
 * --delete-all-subscriptions: removes EVERY Subscription row first (all users),
 * then deletes users not in the allow-list. Use when you want a clean slate for
 * subscriptions while keeping the listed accounts.
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const KEEP_EMAILS = [
  'admin@dogpoint.cz',
  'moderator@dogpoint.cz',
  'bluedrmstyria@gmail.com',
].map((e) => e.toLowerCase())

const prisma = new PrismaClient()

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const deleteAllSubs = process.argv.includes('--delete-all-subscriptions')

  const allUsers = await prisma.user.findMany({ select: { id: true, email: true, role: true } })
  const keepSet = new Set(KEEP_EMAILS)
  const toDelete = allUsers.filter((u) => !keepSet.has(u.email.trim().toLowerCase()))
  const toKeep = allUsers.filter((u) => keepSet.has(u.email.trim().toLowerCase()))

  console.log('Allow-list:', KEEP_EMAILS.join(', '))
  console.log('Keeping:', toKeep.map((u) => `${u.email} (${u.role})`).join('; ') || '(none)')
  console.log('Will delete', toDelete.length, 'user(s):', toDelete.map((u) => u.email).join(', ') || '(none)')

  if (deleteAllSubs) {
    const n = await prisma.subscription.count()
    console.log('--delete-all-subscriptions: removing', n, 'subscription row(s) (cascade: payments, gift rows, share invites tied to subs).')
    if (dryRun) {
      console.log('[dry-run] skipping subscription delete')
    } else {
      const r = await prisma.subscription.deleteMany({})
      console.log('Deleted subscriptions:', r.count)
    }
  }

  if (toDelete.length === 0) {
    console.log('Nothing to do.')
    await prisma.$disconnect()
    return
  }

  const ids = toDelete.map((u) => u.id)

  if (dryRun) {
    console.log('[dry-run] would null FKs and delete users with ids:', ids.length)
    await prisma.$disconnect()
    return
  }

  await prisma.$transaction(async (tx) => {
    await tx.animal.updateMany({
      where: { approvedById: { in: ids } },
      data: { approvedById: null },
    })
    await tx.animal.updateMany({
      where: { createdById: { in: ids } },
      data: { createdById: null },
    })

    await tx.post.updateMany({ where: { authorId: { in: ids } }, data: { authorId: null } })
    await tx.post.updateMany({ where: { approvedById: { in: ids } }, data: { approvedById: null } })
    await tx.post.updateMany({ where: { createdById: { in: ids } }, data: { createdById: null } })

    await tx.notification.deleteMany({ where: { userId: { in: ids } } })

    await tx.pledge.updateMany({ where: { userId: { in: ids } }, data: { userId: null } })

    const del = await tx.user.deleteMany({ where: { id: { in: ids } } })
    console.log('Deleted users:', del.count)
  })

  console.log('Done.')
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
