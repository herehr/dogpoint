// routes/uploadRoutes.ts
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
      if (!req.file) {
        console.error('❌ No file received in request');
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const url = await uploadToSpace(req.file);
      console.log(`✅ File uploaded: ${url}`);
      return res.status(200).json({ url });
    } catch (err: any) {
      console.error('❌ Upload failed:', err.message || err);
      return res.status(500).json({ error: 'Upload failed', detail: err.message });
    }
  }
);

export default router;