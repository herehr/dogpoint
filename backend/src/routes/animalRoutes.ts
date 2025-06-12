import { Router } from 'express';
import prisma from '../prisma';
import { getAllAnimals, getAnimalById } from '../controllers/animalController';

const router = Router();

router.get('/', async (req, res) => {
    try {
      const animals = await prisma.animal.findMany();
      res.json(animals);
    } catch (error) {
      console.error('🔥 Prisma Error in GET /animals:', JSON.stringify(error, null, 2)); // 👈 ADD THIS
      res.status(500).json({ error: 'Internal Server Error', details: error });
    }
  });

router.get('/:id', getAnimalById);

export default router;