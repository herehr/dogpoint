import express from 'express';
const router = express.Router();

router.post('/admin-login', (req, res) => {
  res.json({ token: 'mock-jwt-token' });
});

export default router;
