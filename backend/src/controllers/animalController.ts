import { Request, Response } from 'express';
import prisma from '../services/prisma';

// Get all animals
export const getAllAnimals = async (req: Request, res: Response) => {
  try {
    const animals = await prisma.animal.findMany({
      include: { galerie: true },
    });
    res.json(animals);
  } catch (err) {
    console.error('Error fetching animals:', err);
    res.status(500).json({ error: 'Failed to fetch animals' });
  }
};

// Get a single animal by ID
export const getAnimalById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const animal = await prisma.animal.findUnique({
      where: { id },
      include: { galerie: true },
    });
    if (!animal) {
      return res.status(404).json({ error: 'Animal not found' });
    }
    res.json(animal);
  } catch (err) {
    console.error('Error fetching animal by ID:', err);
    res.status(500).json({ error: 'Failed to fetch animal' });
  }
};