import express from 'express';
import { loginAdmin } from '../controllers/authController';

const router = express.Router();

router.post('/admin-login', loginAdmin);

export default router;
