import express from 'express';
import { register, login } from '../controllers/authController'; // ✅ include register
import { generateToken, checkRole } from '../services/auth';
import { Role } from '@prisma/client';

const router = express.Router();

// 🔧 Test token generation (dev-only)
router.post('/test', (req, res) => {
  const token = generateToken({ id: 'admin123', role: Role.ADMIN });
  res.json({ token });
});

// 🔐 Real login route
router.post('/login', login);

// 🛡️ Protected route for any logged-in user
router.get('/protected', checkRole([Role.ADMIN, Role.MODERATOR, Role.USER]), (req, res) => {
  res.json({
    message: 'You accessed a protected route!',
    user: req.user,
  });
});

// 🧑‍💼 Register new users (only allowed for ADMINs)
router.post('/register', checkRole([Role.ADMIN]), register);

export default router;