import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import animalRoutes from './routes/animals';
import authRoutes from './routes/auth';
import uploadRoutes from './routes/upload';
import adoptionRoutes from './routes/adoption';
import { prisma } from './prisma';

dotenv.config();

const allowedOrigins = [
  'http://localhost:5173',
  'https://dogpoint-frontend-eoikq.ondigitalocean.app',
  'https://herehr.github.io',
];

const app = express();
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

// API routes
app.use('/api/animals', animalRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/adoption', adoptionRoutes);

// Base
app.get('/', (_req: Request, res: Response): void => {
  res.send('Dogpoint backend is running.');
});

// Health
app.get('/health', (_req: Request, res: Response): void => {
  res.status(200).json({ status: 'ok', server: true });
});

app.get('/health/db', async (_req: Request, res: Response): Promise<void> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok', db: true });
  } catch (e: any) {
    res.status(500).json({ status: 'error', db: false, error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on port ${PORT}`);
});