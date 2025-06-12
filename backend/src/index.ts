import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { Role } from '@prisma/client';

import authRoutes from './routes/authRoutes';
import animalRoutes from './routes/animalRoutes';         // ✅ MISSING IMPORT ADDED
import moderatorRoutes from './routes/moderatorRoutes';
import adminRoutes from './routes/adminRoutes';
import uploadRoutes from './routes/uploadRoutes'; // ✅ CORRECT

dotenv.config();

const app = express();

// --- Middleware ---
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// --- API Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/animals', animalRoutes);
app.use('/api/moderators', moderatorRoutes);
app.use('/api/admin', adminRoutes); // ✅ MOUNTED
app.use('/api/upload', uploadRoutes); // ✅ CORRECT


// --- Custom Typing for req.user ---
declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string;
      role: Role;
    };
  }
}

// --- Server Start ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});