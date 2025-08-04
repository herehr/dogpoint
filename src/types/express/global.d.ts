// types/services/global.d.ts
import { Role } from '@prisma/client';
import { Multer } from 'multer';

declare namespace Express {
  export interface Request {
    user?: {
      id: string;
      role: Role;
    };
    file?: Multer.File; // Optional, but helpful if you use multer
  }
}