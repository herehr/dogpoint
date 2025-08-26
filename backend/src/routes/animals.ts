import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/animals - List all animals
router.get('/', async (_req, res) => {
  try {
    const animals = await prisma.animal.findMany({
      include: {
        galerie: true,  // Include media gallery if defined in schema
      },
    });
    res.json(animals);
  } catch (error) {
    console.error('Error fetching animals:', error);
    res.status(500).json({ error: 'Failed to fetch animals' });
  }
});

export default router;