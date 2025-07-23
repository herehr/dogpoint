// src/routes/auth.ts
import { Router } from 'express';
import { loginAdmin } from '../controllers/authController';

const router = Router();

// ✅ Correct signature usage
router.post('/admin-login', (req, res) => {
  loginAdmin(req, res);
});

export default router;