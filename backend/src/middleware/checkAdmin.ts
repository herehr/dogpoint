import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/auth';
import { Role } from '@prisma/client';

export const checkAdmin = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Missing token' });

  try {
    const decoded = verifyToken(token); // already typed
    if (decoded.role !== Role.ADMIN) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};