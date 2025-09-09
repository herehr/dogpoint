// backend/src/middleware/authJwt.ts
import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export type JwtUser = {
  id: string
  role: 'ADMIN' | 'MODERATOR' | 'USER'
  email?: string
  sub?: string
  iat?: number
  exp?: number
}

// Augment Express once so req.user is available everywhere
declare global {
  namespace Express {
    interface Request {
      user?: JwtUser
    }
  }
}

function extractBearer(req: Request): string | null {
  const raw = (req.headers.authorization as string | undefined) ||
              (req.headers as any).Authorization
  if (!raw) return null
  const m = /^\s*Bearer\s+(.+)\s*$/i.exec(Array.isArray(raw) ? raw[0] : raw)
  return m ? m[1] : null
}

const JWT_SECRET = process.env.JWT_SECRET || ''

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractBearer(req)
  if (!token) return res.status(401).json({ error: 'auth required' })
  if (!JWT_SECRET) return res.status(500).json({ error: 'server misconfigured: JWT_SECRET missing' })

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as Partial<JwtUser> & { sub?: string }
    const user: JwtUser = {
      id: (decoded.id ?? decoded.sub ?? '') as string,
      role: (decoded.role ?? 'MODERATOR') as JwtUser['role'],
      email: decoded.email,
      sub: decoded.sub,
      iat: decoded.iat,
      exp: decoded.exp,
    }
    req.user = user
    return next()
  } catch {
    return res.status(401).json({ error: 'invalid token' })
  }
}

export function requireAuthOptional(req: Request, _res: Response, next: NextFunction) {
  const token = extractBearer(req)
  if (!token || !JWT_SECRET) return next()
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as Partial<JwtUser> & { sub?: string }
    req.user = {
      id: (decoded.id ?? decoded.sub ?? '') as string,
      role: (decoded.role ?? 'MODERATOR') as JwtUser['role'],
      email: decoded.email,
      sub: decoded.sub,
      iat: decoded.iat,
      exp: decoded.exp,
    }
  } catch {
    // ignore invalid token
  }
  return next()
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'auth required' })
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'forbidden' })
  return next()
}