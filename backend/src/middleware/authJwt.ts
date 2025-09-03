// backend/src/middleware/authJwt.ts
import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export type JwtUser = { id: string; role: 'ADMIN' | 'MODERATOR' | 'USER' }
declare global {
  namespace Express {
    interface Request { user?: JwtUser }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || ''

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization || ''
    const [, token] = header.split(' ')
    if (!token) return res.status(401).json({ error: 'Missing token' })
    if (!JWT_SECRET) return res.status(500).json({ error: 'Server misconfigured (JWT_SECRET)' })
    const decoded = jwt.verify(token, JWT_SECRET) as any
    req.user = { id: decoded.id || decoded.sub, role: decoded.role }
    return next()
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' })
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' })
  return next()
}