import jwt from 'jsonwebtoken'

export type JwtPayload = { id: string; role: 'USER'|'MODERATOR'|'ADMIN' }

export function signToken(payload: JwtPayload) {
  const secret = process.env.JWT_SECRET || 'dev_secret_change_me'
  return jwt.sign(payload, secret, { expiresIn: '30d' })
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const secret = process.env.JWT_SECRET || 'dev_secret_change_me'
    return jwt.verify(token, secret) as JwtPayload
  } catch {
    return null
  }
}