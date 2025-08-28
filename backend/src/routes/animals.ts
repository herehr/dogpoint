import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

// GET all (public)
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const animals = await prisma.animal.findMany({
      orderBy: { createdAt: 'desc' },
      include: { galerie: true },
    });
    res.json(animals); // returns [] if none
  } catch (e: any) {
    console.error('GET /api/animals error:', e);
    res.status(500).json({ error: 'Internal error fetching animals' });
  }
});

// GET one (public)
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const a = await prisma.animal.findUnique({
      where: { id: String(req.params.id) },
      include: { galerie: true },
    });
    if (!a) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(a);
  } catch (e: any) {
    console.error('GET /api/animals/:id error:', e);
    res.status(500).json({ error: 'Internal error fetching animal' });
  }
});

// CREATE (moderator)
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
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
  } catch (e: any) {
    console.error('POST /api/animals error:', e);
    res.status(500).json({ error: 'Internal error creating animal' });
  }
});

// UPDATE (moderator)
router.patch('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { name, jmeno, description, popis, active } = (req.body || {}) as any;
    const updated = await prisma.animal.update({
      where: { id },
      data: { name, jmeno, description, popis, active },
      include: { galerie: true },
    });
    res.json(updated);
  } catch (e: any) {
    console.error('PATCH /api/animals/:id error:', e);
    res.status(500).json({ error: 'Internal error updating animal' });
  }
});

// DELETE (moderator)
router.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    await prisma.galerieMedia.deleteMany({ where: { animalId: id } });
    await prisma.animal.delete({ where: { id } });
    res.status(204).end();
  } catch (e: any) {
    console.error('DELETE /api/animals/:id error:', e);
    res.status(500).json({ error: 'Internal error deleting animal' });
  }
});

export default router;