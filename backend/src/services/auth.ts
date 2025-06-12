import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';

// --- Custom Typing ---
export interface JwtPayload {
  id: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// --- Generate JWT Token ---
export const generateToken = (user: JwtPayload): string => {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });
};

// --- Verify JWT Token ---
export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
};

// --- Middleware: Role Check ---
export const checkRole = (allowedRoles: Role[]) => (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = verifyToken(token);

    if (!allowedRoles.includes(payload.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    req.user = payload;
    next();
  } catch (err) {
    console.error('Token verification error:', err);
    res.status(401).json({ error: 'Invalid token' });
  }
};