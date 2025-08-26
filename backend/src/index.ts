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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});