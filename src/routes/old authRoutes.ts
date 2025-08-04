import { Router, Request, Response } from 'express';
import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';
import checkRole from '../middleware/checkRole';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// POST /api/auth/admin-login
router.post('/admin-login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  const admin = await prisma.user.findUnique({ where: { email } });

  if (!admin || admin.role !== Role.ADMIN) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const isMatch = await bcrypt.compare(password, admin.password);
  if (!isMatch) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = jwt.sign({ id: admin.id, role: admin.role }, JWT_SECRET, {
    expiresIn: '7d',
  });

  res.json({ token });
});

// POST /api/auth/create-moderator
router.post('/create-moderator',
  checkRole([Role.ADMIN]),
  async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(400).json({ error: 'User already exists' });
      return;
    }

    const hashed = await bcrypt.hash(password, 10);

    const moderator = await prisma.user.create({
      data: {
        email,
        password: hashed,
        role: Role.MODERATOR,
      },
    });

    res.json({ id: moderator.id, email: moderator.email });
  }
);

export default router;