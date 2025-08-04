// backend/src/middleware/checkRole.ts
import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';

export default function checkRole(roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    console.log('🧠 Role check for user:', req.user);

    if (!req.user || !roles.includes(req.user.role)) {
      return void res.status(403).json({ error: 'Unauthorized' });
    }

    return next(); // ✅ All good, proceed
  };
}