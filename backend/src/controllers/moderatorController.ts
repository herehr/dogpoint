// src/controllers/moderatorController.ts
import { Request, Response } from 'express';
import prisma from '../services/prisma';
import { Role } from '@prisma/client';

// ✅ GET /api/moderators/animals
export const getAnimals = async (_req: Request, res: Response) => {
  try {
    const animals = await prisma.animal.findMany({
      include: { galerie: true },
    });
    res.json(animals);
  } catch (err) {
    console.error('Fetch animals error:', err);
    res.status(500).json({ error: 'Failed to fetch animals' });
  }
};

// ✅ POST /api/moderators/animals
export const addAnimal = async (req: Request, res: Response) => {
  const { name, description, galerie } = req.body;

  try {
    const newAnimal = await prisma.animal.create({
      data: {
        name,
        description,
        galerie: {
          create: galerie,
        },
      },
      include: { galerie: true },
    });

    res.status(201).json(newAnimal);
  } catch (err) {
    console.error('Add Animal error:', err);
    res.status(500).json({ error: 'Failed to add animal' });
  }
};

// ✅ DELETE /api/moderators/animals/:id
export const deleteAnimal = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    await prisma.galerieMedia.deleteMany({ where: { animalId: id } });
    await prisma.animal.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete animal' });
  }
};

// ✅ GET /api/moderators/animals/:id
export const getAnimalById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const animal = await prisma.animal.findUnique({
      where: { id },
      include: { galerie: true },
    });
    if (!animal) return res.status(404).json({ error: 'Not found' });
    res.json(animal);
  } catch (err) {
    console.error('Fetch by ID error:', err);
    res.status(500).json({ error: 'Failed to fetch animal' });
  }
};

// ✅ PUT /api/moderators/animals/:id
export const updateAnimal = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description } = req.body;

  try {
    const updated = await prisma.animal.update({
      where: { id },
      data: { name, description },
    });
    res.json(updated);
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ error: 'Update failed' });
  }
};

// ✅ GET /api/moderators (ADMIN-only)
export const getAllModerators = async (_req: Request, res: Response) => {
  try {
    const moderators = await prisma.user.findMany({
      where: {
        role: Role.MODERATOR,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    res.json(moderators);
  } catch (error) {
    console.error('Failed to fetch moderators:', error);
    res.status(500).json({ error: 'Server error while fetching moderators' });
  }
};