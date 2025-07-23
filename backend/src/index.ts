import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes); // ✅ Important

app.get('/', (req, res) => {
  res.send('Dogpoint backend running');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});