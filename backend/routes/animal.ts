import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/animals
router.get('/', async (_req, res) => {
  try {
    const animals = await prisma.animal.findMany({
      include: {
        galerie: true, // ✅ this must match model
      },
    });
    res.json(animals);
  } catch (error) {
    console.error('❌ Error in /api/animals:', error);
    res.status(500).json({ error: 'Failed to fetch animals' });
  }
});

export default router;