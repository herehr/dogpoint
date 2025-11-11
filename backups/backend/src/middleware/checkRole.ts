import { Request, Response, NextFunction } from 'express'

export type Role = 'USER' | 'MODERATOR' | 'ADMIN'
export type AuthPayload = { id: string; role: Role }

/**
 * Requires `checkAuth` to have populated req.user = { id, role }.
 */
export function checkRole(...allowed: Role[]) {
  return (req: Request & { user?: AuthPayload }, res: Response, next: NextFunction) => {
    const role = req.user?.role
    if (!role) return res.status(401).json({ error: 'Unauthorized' })
    if (!allowed.includes(role)) return res.status(403).json({ error: 'Forbidden' })
    next()
  }
}