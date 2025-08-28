// backend/src/routes/adoption.ts
import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';

const router = Router();

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { animalId, name, email, phone, message } = (req.body || {}) as any;
    if (!animalId || !name || !email) { res.status(400).json({ error: 'Missing fields' }); return; }
    const created = await prisma.adoptionRequest.create({
      data: { animalId, name, email, phone, message }
    });
    res.status(201).json(created);
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('adoption error', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;