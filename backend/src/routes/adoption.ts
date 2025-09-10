import { Router, Request, Response } from 'express'
import { prisma } from '../prisma'
import jwt from 'jsonwebtoken'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'

// DEV-ONLY MOCK: complete “payment”, create/ensure user, mark adoption PAID, return JWT
router.post('/mock', async (req: Request, res: Response): Promise<void> => {
  try {
    const { animalId, email, name, monthly } = (req.body || {}) as {
      animalId?: string
      email?: string
      name?: string
      monthly?: number
    }

    if (!animalId) { res.status(400).json({ error: 'animalId required' }); return }
    if (!email)    { res.status(400).json({ error: 'email required' }); return }

    // 1) ensure animal exists
    const animal = await prisma.animal.findUnique({ where: { id: animalId } })
    if (!animal) { res.status(404).json({ error: 'Animal not found' }); return }

    // 2) upsert user (role USER)
    const user = await prisma.user.upsert({
      where: { email },
      update: { },
      create: {
        email,
        passwordHash: null,
        role: 'USER',
      }
    })

    // 3) create adoption request as PAID (pretend payment success)
    await prisma.adoptionRequest.create({
      data: {
        animalId,
        name: name || 'Adopter',
        email,
        status: 'PAID',
        message: monthly ? `Monthly pledge: ${monthly} CZK` : null,
      }
    })

    // 4) issue JWT so the user is logged in immediately
    if (!JWT_SECRET) { res.status(500).json({ error: 'JWT_SECRET missing' }); return }
    const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '7d' })

    // In real prod you’d persist a table like Access(userId, animalId)
    // For MVP we return allowed animalId; frontend uses AccessContext.grantAccess
    res.json({ ok: true, token, access: { [animalId]: true } })
  } catch (e: any) {
    console.error('/api/adoption/mock error', e)
    res.status(500).json({ error: 'Internal error (mock adoption)' })
  }
})

export default router