// backend/src/jobs/pgAdvisoryLock.ts
import { prisma } from '../prisma'

/** Serialize a job across multiple app instances (returns null if another instance holds the lock). */
export async function withPgAdvisoryLock<T>(key: number, fn: () => Promise<T>): Promise<T | null> {
  const got = await prisma.$queryRawUnsafe<{ locked: boolean }[]>(
    `SELECT pg_try_advisory_lock(${key}) as locked`
  )
  if (!got?.[0]?.locked) return null
  try {
    return await fn()
  } finally {
    await prisma.$queryRawUnsafe(`SELECT pg_advisory_unlock(${key})`)
  }
}
