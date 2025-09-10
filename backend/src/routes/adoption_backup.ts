import { Router, Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

type JwtUser = { sub: string; email?: string; role?: string }
declare global {
  // augment Request to hold auth user
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface Request {
      authUser?: JwtUser | null
    }
  }
}

const router = Router()

/** ---------------------------
 *  Very small in-memory access store (MVP)
 *  key: userId (sub) → Set of animalIds
 *  NOTE: resets on server restart; replace with DB when wiring Stripe webhooks.
 * --------------------------- */
const accessByUser: Map<string, Set<string>> = new Map()

/** Attach req.authUser if Authorization: Bearer <JWT> is present */
function tryAuth(req: Request, _res: Response, next: NextFunction) {
  const hdr = req.headers['authorization'] || ''
  const m = /^Bearer\s+(.+)$/.exec(Array.isArray(hdr) ? hdr[0] : hdr)
  if (m) {
    const token = m[1]
    const secret = process.env.JWT_SECRET
    if (secret) {
      try {
        const payload = jwt.verify(token, secret) as any
        req.authUser = {
          sub: String(payload?.sub ?? ''),
          email: payload?.email,
          role: payload?.role,
        }
      } catch {
        req.authUser = null
      }
    }
  }
  next()
}

/** GET /api/adoption/access/:animalId → { access: boolean }
 *  - If user not authenticated, returns { access:false }.
 *  - If authenticated, returns whether user has access for that animal.
 */
router.get('/access/:animalId', tryAuth, (req: Request, res: Response): void => {
  const animalId = String(req.params.animalId || '')
  if (!animalId) {
    res.status(400).json({ access: false, error: 'animalId required' }); return
  }
  const uid = req.authUser?.sub
  if (!uid) { res.json({ access: false }); return }

  const set = accessByUser.get(uid)
  res.json({ access: !!(set && set.has(animalId)) })
})

/** POST /api/adoption/start { animalId } → { ok:true, granted:boolean }
 *  MVP: if authenticated, we SIMULATE success and grant access immediately.
 *  Replace with Stripe Checkout + webhook that grants access after payment.
 */
router.post('/start', tryAuth, (req: Request, res: Response): void => {
  const { animalId } = (req.body || {}) as { animalId?: string }
  if (!animalId) { res.status(400).json({ ok: false, error: 'animalId required' }); return }
  const uid = req.authUser?.sub
  if (!uid) { res.status(401).json({ ok: false, error: 'auth required' }); return }

  let set = accessByUser.get(uid)
  if (!set) { set = new Set(); accessByUser.set(uid, set) }
  set.add(animalId)

  // In a real flow you’d respond with a Stripe Checkout URL here.
  res.json({ ok: true, granted: true })
})

export default router