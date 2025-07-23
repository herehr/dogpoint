import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import animalRoutes from './routes/animals';
import authRoutes from './routes/auth'; // ✅ Import auth routes

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Mount routes
app.use('/api/animals', animalRoutes);
app.use('/api/auth', authRoutes); // ✅ Add this line

app.get('/', (_req, res) => {
  res.send('Dogpoint backend is running.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});