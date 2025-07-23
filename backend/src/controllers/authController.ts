import { Request, Response } from 'express';
import prisma from '../prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// ✅ No explicit return type — TypeScript infers it automatically
export const loginAdmin = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    console.log('🟡 Incoming admin login request:', { email });

    if (!email || !password) {
      console.log('🔴 Missing email or password');
      res.status(400).json({ error: 'Email a heslo jsou povinné.' });
      return;
    }

    const admin = await prisma.user.findUnique({ where: { email } });
    console.log('🟢 Admin fetched from DB:', admin);

    if (!admin) {
      console.log('🔴 Admin not found');
      res.status(401).json({ error: 'Neplatné přihlašovací údaje.' });
      return;
    }

    if (admin.role !== 'ADMIN') {
      console.log('🔴 User role is not ADMIN:', admin.role);
      res.status(403).json({ error: 'Nemáte oprávnění.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    console.log('🟢 Password match:', isMatch);

    if (!isMatch) {
      console.log('🔴 Password mismatch');
      res.status(401).json({ error: 'Neplatné přihlašovací údaje.' });
      return;
    }

    if (!process.env.JWT_SECRET) {
      console.log('❌ JWT_SECRET is not defined!');
      res.status(500).json({ error: 'Chybí JWT tajný klíč.' });
      return;
    }

    const token = jwt.sign({ id: admin.id, role: admin.role }, process.env.JWT_SECRET, {
      expiresIn: '1d',
    });

    console.log('✅ Token generated for admin:', token);
    res.json({ token });
  } catch (err) {
    console.error('❌ Serverová chyba při přihlašování admina:', err);
    res.status(500).json({ error: 'Serverová chyba.' });
  }
};