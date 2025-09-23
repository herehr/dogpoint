// backend/src/middleware/authJwt.ts
import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
// If you want to enforce "active" users, uncomment the prisma import and the code in requireActiveUser
// import { prisma } from '../prisma'

export type JwtRole = 'ADMIN' | 'MODERATOR' | 'USER'
export type JwtUser = {
  id: string
  role: JwtRole
  email?: string
  sub?: string
  iat?: number
  exp?: number
}

// Augment Express.Request so req.user is available everywhere
declare global {
  namespace Express {
    interface Request {
      user?: JwtUser
    }
  }
}

function extractBearer(req: Request): string | null {
  const raw =
    (req.headers.authorization as string | undefined) ||
    (req.headers as any).Authorization
  if (!raw) return null
  const m = /^\s*Bearer\s+(.+)\s*$/i.exec(Array.isArray(raw) ? raw[0] : raw)
  return m ? m[1] : null
}

const JWT_SECRET = process.env.JWT_SECRET || ''

function decodeToken(token: string): JwtUser | null {
  try {
    const d = jwt.verify(token, JWT_SECRET) as Partial<JwtUser> & { sub?: string }
    const id = (d.id ?? d.sub ?? '') as string
    if (!id) return null
    // 👇 IMPORTANT: default to USER, not MODERATOR
    const role = (d.role ?? 'USER') as JwtRole
    return {
      id,
      role,
      email: d.email,
      sub: d.sub,
      iat: d.iat,
      exp: d.exp,
    }
  } catch {
    return null
  }
}

/**
 * Require a valid JWT. Attaches req.user.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractBearer(req)
  if (!token) return res.status(401).json({ error: 'auth required' })
  if (!JWT_SECRET) return res.status(500).json({ error: 'server misconfigured: JWT_SECRET missing' })

  const user = decodeToken(token)
  if (!user) return res.status(401).json({ error: 'invalid token' })
  req.user = user
  next()
}

/**
 * If a valid JWT is present, attach req.user; otherwise continue.
 */
export function requireAuthOptional(req: Request, _res: Response, next: NextFunction) {
  const token = extractBearer(req)
  if (!token || !JWT_SECRET) return next()
  const user = decodeToken(token)
  if (user) req.user = user
  next()
}

/**
 * Only ADMIN can pass.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'auth required' })
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'forbidden' })
  next()
}

/**
 * ADMIN or MODERATOR can pass.
 */
export function requireStaff(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'auth required' })
  if (req.user.role !== 'ADMIN' && req.user.role !== 'MODERATOR') {
    return res.status(403).json({ error: 'forbidden' })
  }
  next()
}

/**
 * (Optional) Block deactivated users globally on protected routes.
 * Requires a boolean `active` field on User.
 */
// export async function requireActiveUser(req: Request, res: Response, next: NextFunction) {
//   if (!req.user) return res.status(401).json({ error: 'auth required' })
//   try {
//     const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { active: true } })
//     if (!u) return res.status(401).json({ error: 'invalid user' })
//     if (u.active === false) return res.status(403).json({ error: 'user deactivated' })
//     next()
//   } catch (e) {
//     return res.status(500).json({ error: 'internal error' })
//   }
// }