import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { Role } from '@prisma/client';
import fs from 'fs';

dotenv.config();

import authRoutes from './routes/authRoutes';
import animalRoutes from './routes/animalRoutes';
import moderatorRoutes from './routes/moderatorRoutes';
import adminRoutes from './routes/adminRoutes';
import uploadRoutes from './routes/uploadRoutes';

const app = express();

// --- Middleware ---
app.use(cors({
  origin: ['http://localhost:5173', 'https://dogpoint-uk3y8.ondigitalocean.app'],
  credentials: true,
}));
app.use(express.json());

// --- Health check ---
app.get('/api/ping', (_req, res) => {
  res.json({ message: 'pong' });
});


// --- API Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/animals', animalRoutes);
app.use('/api/moderators', moderatorRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);

// --- Custom Typing for req.user ---
declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string;
      role: Role;
    };
  }
}

// --- 404 handler ---
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// --- Error handler (optional) ---
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('💥 Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// --- Server Start ---
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});