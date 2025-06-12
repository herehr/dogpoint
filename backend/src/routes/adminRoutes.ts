import express from 'express';
import { checkRole } from '../services/auth';
import { Role } from '@prisma/client';
import { getAllUsers } from '../controllers/adminController';

const router = express.Router();

// 🔐 Admin-only route to list all users
router.get('/users', checkRole([Role.ADMIN]), getAllUsers);

export default router;