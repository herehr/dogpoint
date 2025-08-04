import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import doUpload from '../services/doUpload';
import checkRole from '../middleware/checkRole';
import checkAuth from '../middleware/checkAuth'; // Make sure you also check auth
import { Role } from '@prisma/client';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/upload
router.post(
  '/',
  [checkAuth, checkRole([Role.MODERATOR, Role.ADMIN]), upload.single('file')],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const file = req.file;

      if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const ext = file.originalname.split('.').pop();
      const key = `uploads/${uuidv4()}.${ext}`;

      const url = await doUpload(file.buffer, key, file.mimetype);

      res.json({ url });
    } catch (err) {
      console.error('Upload failed:', err);
      res.status(500).json({ error: 'Upload failed' });
    }
  }
);

export default router;