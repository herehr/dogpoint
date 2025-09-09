// backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export type JwtUser = {
  sub: string
  role?: 'ADMIN' | 'MODERATOR' | 'USER'
  email?: string
  // iat/exp are standard fields but optional here
  iat?: number
  exp?: number
}

// Narrow request type we’ll use internally when we attach a user
export interface AuthedRequest extends Request {
  user?: JwtUser
}

function getToken(req: Request): string | null {
  const h = req.headers.authorization || req.headers.Authorization
  if (!h) return null
  const s = Array.isArray(h) ? h[0] : h
  const m = /^Bearer\s+(.+)$/i.exec(s)
  return m ? m[1] : null
}

/**
 * Strict auth: rejects with 401 if the Authorization header is missing/invalid.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = getToken(req)
  if (!token) return res.status(401).json({ error: 'auth required' })

  const secret = process.env.JWT_SECRET
  if (!secret) return res.status(500).json({ error: 'server misconfigured: JWT_SECRET missing' })

  try {
    const payload = jwt.verify(token, secret) as JwtUser
    ;(req as AuthedRequest).user = payload
    next()
  } catch (e: any) {
    return res.status(401).json({ error: 'invalid token' })
  }
}

/**
 * Optional auth: if a valid token is present, attaches req.user; otherwise continues anonymous.
 */
export function requireAuthOptional(req: Request, _res: Response, next: NextFunction) {
  const token = getToken(req)
  const secret = process.env.JWT_SECRET
  if (!token || !secret) return next()

  try {
    const payload = jwt.verify(token, secret) as JwtUser
    ;(req as AuthedRequest).user = payload
  } catch {
    // ignore invalid token, continue as anonymous
  }
  next()
}