import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// GET /api/animals - List all animals, with optional ?all=true
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const showAll = req.query.all === 'true';

  try {
    const animals = await prisma.animal.findMany({
      where: showAll ? {} : { isActive: true },
      include: {
        galerie: true,
      },
    });

    res.json(animals);
  } catch (error) {
    console.error('❌ Error fetching animals:', error);
    res.status(500).json({ error: 'Failed to fetch animals' });
  }
});

export default router;