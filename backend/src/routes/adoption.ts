// backend/src/routes/adoption.ts
import { Router, Request, Response } from 'express'
import { prisma } from '../prisma'
import jwt from 'jsonwebtoken'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'

type AdoptBody = {
  animalId?: string
  email?: string
  name?: string
  monthly?: number
}

// shared handler (used by /mock and /start)
async function handleDevAdoption(req: Request, res: Response) {
  try {
    const { animalId, email, name, monthly } = (req.body || {}) as AdoptBody

    if (!animalId) { res.status(400).json({ error: 'animalId required' }); return }
    if (!email)    { res.status(400).json({ error: 'email required' }); return }

    const animal = await prisma.animal.findUnique({ where: { id: animalId } })
    if (!animal) { res.status(404).json({ error: 'Animal not found' }); return }

    // Upsert user (USER role)
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, passwordHash: null, role: 'USER' },
    })

    // Create a PAID adoption request (simulate payment success)
    await prisma.adoptionRequest.create({
      data: {
        animalId,
        name: name || 'Adopter',
        email,
        status: 'PAID',
        message: monthly ? `Monthly pledge: ${monthly} CZK` : null,
      },
    })

    if (!JWT_SECRET) { res.status(500).json({ error: 'JWT_SECRET missing' }); return }
    const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, {
      expiresIn: '7d',
    })

    // Frontend will store token and call grantAccess(animalId)
    res.json({ ok: true, token, access: { [animalId]: true } })
  } catch (e: any) {
    console.error('/api/adoption dev handler error', e)
    res.status(500).json({ error: 'Internal error (adoption)' })
  }
}

// DEV endpoints
router.post('/mock', handleDevAdoption)
// alias so existing UI that posts to /start keeps working
router.post('/start', handleDevAdoption)

export default router