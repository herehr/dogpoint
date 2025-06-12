import express from 'express';
import { checkRole } from '../services/auth';
import { Role } from '@prisma/client';
import {
  getAnimals,
  addAnimal,
  deleteAnimal,
  getAnimalById,
  updateAnimal,
} from '../controllers/moderatorController';

const router = express.Router();

// ✅ GET: List all animals
router.get('/animals', checkRole([Role.MODERATOR]), getAnimals);

// ✅ POST: Add a new animal
router.post('/animals', checkRole([Role.MODERATOR]), addAnimal);

// ✅ GET: Fetch single animal for editing
router.get('/animals/:id', checkRole([Role.MODERATOR]), getAnimalById);

// ✅ PUT: Update animal
router.put('/animals/:id', checkRole([Role.MODERATOR]), updateAnimal);

// ✅ DELETE: Remove animal
router.delete('/animals/:id', checkRole([Role.MODERATOR]), deleteAnimal);

export default router;