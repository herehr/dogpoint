// types/express/global.d.ts
import { Role } from '@prisma/client';
import { Multer } from 'multer';

declare namespace Express {
  export interface Request {
    user?: {
      id: string;
      role: Role;
    };
    file?: Express.Multer.File; // ✅ Use this, not Multer.File
  }
}