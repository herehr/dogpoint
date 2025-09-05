import { Router, type Request, type Response } from 'express'
import multer from 'multer'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { lookup as mimeLookup } from 'mime-types'
import crypto from 'crypto'

const router = Router()

/**
 * Multer v2: keep the callback loose enough for both accept/reject paths.
 * Using `cb: any` avoids the null-vs-Error mismatch from stricter inferred types.
 * Runtime API is the same: `cb(null, true/false)` or `cb(new Error(...))`.
 */
const fileFilter = (_req: Request, file: Express.Multer.File, cb: any) => {
  const ext = (file.originalname.split('.').pop() || '').toLowerCase()
  const ok =
    (file.mimetype?.startsWith('image/') || file.mimetype?.startsWith('video/')) ||
    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov'].includes(ext)

  if (ok) cb(null, true)
  else cb(new Error('Unsupported file type'), false)
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter
})

/**
 * S3 client for DigitalOcean Spaces:
 * - region is a signing value (DO accepts 'us-east-1')
 * - endpoint is the actual Spaces endpoint, e.g. fra1
 */
const s3 = new S3Client({
  region: process.env.DO_SPACE_REGION || 'us-east-1',
  endpoint: (process.env.DO_SPACE_ENDPOINT || 'https://fra1.digitaloceanspaces.com').replace(/\/+$/, ''),
  forcePathStyle: false,
  credentials: {
    accessKeyId: process.env.DO_SPACE_KEY || '',
    secretAccessKey: process.env.DO_SPACE_SECRET || ''
  }
})

router.get('/selftest', async (_req: Request, res: Response) => {
  try {
    const bucket = process.env.DO_SPACE_BUCKET
    if (!bucket) return res.status(500).json({ ok: false, error: 'DO_SPACE_BUCKET missing' })
    await s3.config.region()
    res.json({
      ok: true,
      bucket,
      endpoint: process.env.DO_SPACE_ENDPOINT || 'https://fra1.digitaloceanspaces.com'
    })
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.name || 'UnknownError', message: e?.message })
  }
})

router.post('/', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) { res.status(400).json({ error: 'file missing' }); return }
    const bucket = process.env.DO_SPACE_BUCKET
    if (!bucket) { res.status(500).json({ error: 'Server misconfigured: DO_SPACE_BUCKET missing' }); return }

    const ext = (req.file.originalname.split('.').pop() || '').toLowerCase()
    const key = `uploads/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}.${ext || 'bin'}`
    const contentType = req.file.mimetype || (mimeLookup(ext) || 'application/octet-stream')

    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: req.file.buffer,
      ACL: 'public-read',
      ContentType: String(contentType)
    }))

    const base = (process.env.DO_SPACE_ENDPOINT || 'https://fra1.digitaloceanspaces.com').replace(/\/+$/, '')
    const url = `${base}/${bucket}/${key}`
    res.json({ url })
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('upload error', e)
    res.status(500).json({ error: 'upload failed', detail: e.message })
  }
})

export default router