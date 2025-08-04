import { Router, Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';
import checkRole from '../middleware/checkRole';
import checkAuth from '../middleware/checkAuth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// ✅ Admin Login
router.post('/admin-login', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
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

    const token = jwt.sign({ id: admin.id, role: admin.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
    return;
  } catch (err) {
    next(err);
  }
});

// ✅ Moderator Login
router.post('/moderator-login', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;
    const moderator = await prisma.user.findUnique({ where: { email } });

    if (!moderator || moderator.role !== Role.MODERATOR) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const isMatch = await bcrypt.compare(password, moderator.password);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign({ id: moderator.id, role: moderator.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
    return;
  } catch (err) {
    next(err);
  }
});

// ✅ Admin creates moderator
router.post(
  '/create-moderator',
  [checkAuth, checkRole([Role.ADMIN])],
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
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
          active: true,
        },
      });

      res.status(201).json({
        id: moderator.id,
        email: moderator.email,
        role: moderator.role,
      });
      return;
    } catch (err) {
      next(err);
    }
  }
);

export default router;