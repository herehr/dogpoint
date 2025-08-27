import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import animalRoutes from './routes/animals'; // ✅ add this line

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 🐾 Mount animal routes
app.use('/api/animals', animalRoutes); // ✅ enable this

// Base test route
app.get('/', (_req, res) => {
  res.send('Dogpoint backend is running.');
});
// health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', server: true });
});

app.get('/health/db', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: true });
  } catch (e) {
    res.status(500).json({ status: 'error', db: false, error: (e as Error).message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});