import express, { Request, Response } from 'express';
import { Role } from '@prisma/client';
import checkAuth from '../middleware/checkAuth';
import checkRole from '../middleware/checkRole';
import prisma from '../lib/prisma';

const router = express.Router();

// GET /api/admin/moderators
router.get(
  '/moderators',
  [checkAuth, checkRole([Role.ADMIN])],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const moderators = await prisma.user.findMany({
        where: { role: Role.MODERATOR },
        select: { id: true, email: true, active: true, createdAt: true },
      });
      res.json(moderators);
    } catch (error) {
      console.error('❌ Error loading moderators:', error);
      res.status(500).json({ error: 'Failed to load moderators' });
    }
  }
);

// PATCH /api/admin/moderators/:id
router.patch(
  '/moderators/:id',
  [checkAuth, checkRole([Role.ADMIN])],
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { active } = req.body;

    try {
      const updated = await prisma.user.update({
        where: { id },
        data: { active },
        select: { id: true, email: true, active: true },
      });
      res.json(updated);
    } catch (error) {
      console.error('❌ Error updating moderator:', error);
      res.status(500).json({ error: 'Failed to update moderator' });
    }
  }
);

// POST /api/admin/create-moderator
router.post(
  '/create-moderator',
  [checkAuth, checkRole([Role.ADMIN])],
  async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    try {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        res.status(409).json({ error: 'User already exists' });
        return;
      }

      const newModerator = await prisma.user.create({
        data: {
          email,
          password, // ⛔ Hash this in production!
          role: Role.MODERATOR,
          active: true,
        },
        select: {
          id: true,
          email: true,
          role: true,
          active: true,
        },
      });

      res.status(201).json(newModerator);
    } catch (error) {
      console.error('❌ Error creating moderator:', error);
      res.status(500).json({ error: 'Failed to create moderator' });
    }
  }
);

export default router;