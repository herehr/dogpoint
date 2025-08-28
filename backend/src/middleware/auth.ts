// backend/src/middleware/auth.ts
import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';

// Use the existing global augmentation: req.user?: { id: string; role: Role }
export const requireAuth: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'Missing token' });
    return;
  }
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ error: 'Server misconfigured: JWT_SECRET missing' });
    return;
  }
  try {
    const payload = jwt.verify(token, secret) as any; // { sub, role?, email? }
    // Conform to global type shape: { id: string; role: Role }
    (req as any).user = {
      id: String(payload.sub ?? ''),
      role: (payload.role as any) || 'MODERATOR',
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};