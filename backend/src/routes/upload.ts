// src/routes/uploadRoutes.ts
import express from 'express';
import multer from 'multer';
import { uploadToSpace } from '../services/doUpload';
import { checkRole } from '../services/auth';
import { Role } from '@prisma/client';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post(
  '/',
  checkRole([Role.MODERATOR]),
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      const url = await uploadToSpace(req.file);
      res.json({ url });
    } catch (err) {
      console.error('Upload failed:', err);
      res.status(500).json({ error: 'Upload failed' });
    }
  }
);

export default router;