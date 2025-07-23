import { Request, Response } from 'express';
import prisma from '../prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const loginAdmin = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    console.log('🟡 Admin login attempt:', { email });

    // 🔵 Validate input
    if (typeof email !== 'string' || typeof password !== 'string') {
      console.log('🔴 Missing or invalid email/password format');
      return res.status(400).json({ error: 'Email a heslo jsou povinné.' });
    }

    // 🔵 Lookup admin by email
    const admin = await prisma.user.findUnique({ where: { email } });

    if (!admin) {
      console.log('🔴 Admin not found for email:', email);
      return res.status(401).json({ error: 'Neplatné přihlašovací údaje.' });
    }

    if (admin.role !== 'ADMIN') {
      console.log(`🔴 Přístup odepřen: role je ${admin.role}`);
      return res.status(403).json({ error: 'Nemáte oprávnění.' });
    }

    // 🔵 Check password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      console.log('🔴 Heslo nesouhlasí');
      return res.status(401).json({ error: 'Neplatné přihlašovací údaje.' });
    }

    // 🔵 Ensure JWT secret is defined
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('❌ JWT_SECRET není definován v .env');
      return res.status(500).json({ error: 'Chybí JWT tajný klíč.' });
    }

    // ✅ Create token
    const token = jwt.sign({ id: admin.id, role: admin.role }, jwtSecret, {
      expiresIn: '1d',
    });

    console.log('✅ Admin login successful:', { adminId: admin.id });

    return res.json({ token });

  } catch (err) {
    console.error('❌ Serverová chyba při přihlášení admina:', err);
    return res.status(500).json({ error: 'Serverová chyba.' });
  }
};