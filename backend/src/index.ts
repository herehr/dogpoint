import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { prisma } from './prisma';          // ← import shared Prisma client
import animalRoutes from './routes/animals';

dotenv.config();

const app = express();

// CORS — allow localhost (dev) and your DO frontend (prod)
const allowedOrigins = [
  'http://localhost:5173',
  // ⬇️ replace with your real DO frontend URL
  'https://dogpoint-frontend-eoikq.ondigitalocean.app',
];

app.use(
  cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

app.use(express.json());

// Routes
app.use('/api/animals', animalRoutes);

// Base test route
app.get('/', (_req, res) => {
  res.send('Dogpoint backend is running.');
});

// Health checks
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', server: true });
});

app.get('/health/db', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: true });
  } catch (e) {
    res
      .status(500)
      .json({ status: 'error', db: false, error: (e as Error).message });
  }
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});