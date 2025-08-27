import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';

const router = Router();

router.get('/ping', (_req: Request, res: Response) => {
  res.json({ ok: true, route: '/api/auth/*' });
});

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = (req.body || {}) as { email?: string; password?: string };
    if (!email || !password) { res.status(400).json({ error: 'Missing email or password' }); return; }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) { res.status(401).json({ error: 'Invalid credentials' }); return; }

    const stored = (user as any).passwordHash ?? (user as any).password;
    if (!stored) { res.status(500).json({ error: 'User has no password set' }); return; }

    const ok = await bcrypt.compare(password, stored);
    if (!ok) { res.status(401).json({ error: 'Invalid credentials' }); return; }

    const secret = process.env.JWT_SECRET;
    if (!secret) { res.status(500).json({ error: 'Server misconfigured: JWT_SECRET missing' }); return; }

    const token = jwt.sign(
      { sub: user.id, role: (user as any).role ?? 'MODERATOR', email: user.email },
      secret,
      { expiresIn: '7d' }
    );
    res.json({ token, role: (user as any).role ?? 'MODERATOR' });
  } catch (e: any) {
    console.error('Auth login error:', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;