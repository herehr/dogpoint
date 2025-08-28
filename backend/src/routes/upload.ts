// backend/src/routes/upload.ts
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { lookup as mimeLookup } from 'mime-types';
import crypto from 'crypto';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const s3 = new S3Client({
  region: process.env.DO_SPACE_REGION || 'fra1',
  endpoint: process.env.DO_SPACE_ENDPOINT || 'https://fra1.digitaloceanspaces.com',
  forcePathStyle: false,
  credentials: {
    accessKeyId: process.env.DO_SPACE_KEY || '',
    secretAccessKey: process.env.DO_SPACE_SECRET || '',
  },
});

router.post('/', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) { res.status(400).json({ error: 'file missing' }); return; }
    const bucket = process.env.DO_SPACE_BUCKET;
    if (!bucket) { res.status(500).json({ error: 'Server misconfigured: DO_SPACE_BUCKET missing' }); return; }

    const ext = (req.file.originalname.split('.').pop() || '').toLowerCase();
    const key = `uploads/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}.${ext || 'bin'}`;
    const contentType = req.file.mimetype || (mimeLookup(ext) || 'application/octet-stream');

    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: req.file.buffer,
      ACL: 'public-read',
      ContentType: String(contentType),
    }));

    const base = (process.env.DO_SPACE_ENDPOINT || 'https://fra1.digitaloceanspaces.com').replace(/\/+$/, '');
    const url = `${base}/${bucket}/${key}`;
    res.json({ url });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('upload error', e);
    res.status(500).json({ error: 'upload failed', detail: e.message });
  }
});

export default router;