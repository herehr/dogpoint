// backend/src/controllers/authExtra.ts
import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../prisma'
import { Role } from '@prisma/client'

const JWT_SECRET = process.env.JWT_SECRET || 'changeme'

export async function registerAfterPayment(req: Request, res: Response) {
  try {
    const { email, password, name } = (req.body || {}) as {
      email?: string; password?: string; name?: string
    }

    if (!email || typeof email !== 'string') {
      res.status(400).send('Email required')
      return
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      res.status(400).send('Password must be at least 6 chars')
      return
    }

    const hash = await bcrypt.hash(password, 10)

    // If the user exists, set password if missing; otherwise create a new USER
    let user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      user = await prisma.user.create({
        data: { email, passwordHash: hash, role: Role.USER, posts: {}, subscriptions: {} } as any,
      })
    } else if (!user.passwordHash) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: hash, ...(name ? { /* place to store name if you add it to schema */ } : {}) },
      })
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' })
    res.json({ token })
  } catch (e: any) {
    res.status(500).send(e?.message || 'Registration failed')
  }
}