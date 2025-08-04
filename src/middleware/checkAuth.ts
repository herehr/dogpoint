// backend/src/middleware/checkAuth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';

interface JwtPayload {
  id: string;
  role: Role;
  iat?: number;
  exp?: number;
}

// You must extend the type of Request to include `user`
// But this will come from types/express/index.d.ts!

const JWT_SECRET = process.env.JWT_SECRET as string;

export default function checkAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return void res.status(401).json({ error: 'Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    console.log('🔐 Decoded JWT:', decoded);

    req.user = decoded; // ✅ Works with correct express type override
    return void next();
  } catch (err) {
    console.error('❌ JWT verification failed:', err);
    return void res.status(403).json({ error: 'Invalid token' });
  }
}