// backend/src/routes/animals.ts
import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

// GET all (public)
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const animals = await prisma.animal.findMany({
    orderBy: { createdAt: 'desc' },
    include: { galerie: true },
  });
  res.json(animals);
});

// GET one (public)
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const a = await prisma.animal.findUnique({
    where: { id: String(req.params.id) },
    include: { galerie: true },
  });
  if (!a) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(a);
});

// CREATE (moderator)
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { name, jmeno, description, popis, active, galerie } = (req.body || {}) as any;
  const created = await prisma.animal.create({
    data: {
      name,
      jmeno,
      description,
      popis,
      active: Boolean(active),
      galerie: Array.isArray(galerie) && galerie.length
        ? { create: galerie.map((g: any) => ({ url: g.url, typ: g.typ ?? 'image' })) }
        : undefined,
    },
    include: { galerie: true },
  });
  res.status(201).json(created);
});

// UPDATE (moderator)
router.patch('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const { name, jmeno, description, popis, active } = (req.body || {}) as any;
  const updated = await prisma.animal.update({
    where: { id },
    data: { name, jmeno, description, popis, active },
    include: { galerie: true },
  });
  res.json(updated);
});

// DELETE (moderator)
router.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  await prisma.galerieMedia.deleteMany({ where: { animalId: id } });
  await prisma.animal.delete({ where: { id } });
  res.status(204).end();
});

export default router;