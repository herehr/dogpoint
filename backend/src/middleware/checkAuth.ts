import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export type AuthPayload = { id: string; role: 'USER' | 'MODERATOR' | 'ADMIN' }

export function checkAuth(
  req: Request & { user?: AuthPayload },
  res: Response,
  next: NextFunction
) {
  const h = req.headers.authorization || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const raw = jwt.verify(
      token,
      process.env.JWT_SECRET || 'dev_secret_change_me'
    ) as any

    // ✅ normalize payload:
    // accept BOTH { id } and { sub }
    const id = raw?.id || raw?.sub
    const role = raw?.role

    if (!id || !role) {
      return res.status(401).json({ error: 'Invalid token payload' })
    }

    req.user = {
      id: String(id),
      role,
    }

    next()
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }
}