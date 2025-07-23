import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import animalRoutes from './routes/animals';
import authRoutes from './routes/authRoutes'; // ✅ import auth routes

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Mount your auth routes under /api/auth
app.use('/api/auth', authRoutes);

// 🐾 Mount animal routes under /api/animals
app.use('/api/animals', animalRoutes);

// Base route
app.get('/', (_req, res) => {
  res.send('Dogpoint backend is running.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});