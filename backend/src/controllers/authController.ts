import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const loginAdmin = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  try {
    const admin = await prisma.user.findUnique({ where: { email } });

    if (!admin || admin.role !== 'ADMIN') {
      res.status(401).json({ error: 'Neplatné přihlašovací údaje.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      res.status(401).json({ error: 'Neplatné heslo.' });
      return;
    }

    const token = jwt.sign(
      { id: admin.id, role: admin.role },
      process.env.JWT_SECRET!,
      { expiresIn: '1d' }
    );

    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: 'Serverová chyba.' });
  }
};