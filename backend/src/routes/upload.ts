// backend/src/routes/upload.ts
import { Router, Request, Response } from 'express'
import multer from 'multer'
import { S3Client, PutObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3'
import { lookup as mimeLookup } from 'mime-types'
import crypto from 'crypto'

// ---- Env (supports DO_SPACE_* or SPACES_* names) ----
const ENDPOINT_HOST =
  (process.env.DO_SPACE_ENDPOINT || process.env.SPACES_ENDPOINT || 'fra1.digitaloceanspaces.com')
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')
const SIGN_REGION = (process.env.DO_SPACE_REGION || process.env.SPACES_REGION || 'us-east-1') // DO recommends us-east-1 signing
const BUCKET = process.env.DO_SPACE_BUCKET || process.env.SPACES_BUCKET || ''
const ACCESS_KEY = process.env.DO_SPACE_KEY || process.env.SPACES_KEY || ''
const SECRET_KEY = process.env.DO_SPACE_SECRET || process.env.SPACES_SECRET || ''
const PUBLIC_BASE = (process.env.DO_SPACE_PUBLIC_BASE || process.env.SPACES_PUBLIC_BASE || '').replace(/\/+$/, '')

const router = Router()

// ---- Multer (memory) ----
// NOTE: no FileFilterCallback import — we type inline to avoid TS compatibility hiccups.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
    if (/^(image|video)\//.test(file.mimetype)) return cb(null, true)
    cb(new Error('Unsupported file type: ' + file.mimetype), false)
  },
})

// ---- S3 client for DO Spaces ----
const s3 = new S3Client({
  region: SIGN_REGION,
  endpoint: `https://${ENDPOINT_HOST}`, // e.g. https://fra1.digitaloceanspaces.com
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
})

// helper: build public URL
function publicUrl(bucket: string, key: string): string {
  if (PUBLIC_BASE) return `${PUBLIC_BASE}/${key}`
  return `https://${bucket}.${ENDPOINT_HOST}/${key}` // virtual-hosted
}

// ---- Diagnostics endpoint: verify bucket/creds quickly ----
router.get('/selftest', async (_req: Request, res: Response) => {
  try {
    if (!BUCKET) return res.status(500).json({ ok: false, error: 'BUCKET_MISSING' })
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }))
    return res.json({
      ok: true,
      bucket: BUCKET,
      endpoint: ENDPOINT_HOST,
      region: SIGN_REGION,
      publicBase: PUBLIC_BASE || `https://${BUCKET}.${ENDPOINT_HOST}`,
    })
  } catch (e: any) {
    return res.status(500).json({
      ok: false,
      error: e?.name || 'HeadBucketError',
      message: e?.message || String(e),
      bucket: BUCKET,
      endpoint: ENDPOINT_HOST,
      region: SIGN_REGION,
    })
  }
})

// ---- Upload endpoint ----
router.post('/', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) { res.status(400).json({ error: 'FILE_MISSING' }); return }
    if (!BUCKET || !ACCESS_KEY || !SECRET_KEY) {
      res.status(500).json({
        error: 'SPACES_NOT_CONFIGURED',
        detail: { BUCKET: !!BUCKET, ACCESS_KEY: !!ACCESS_KEY, SECRET_KEY: !!SECRET_KEY }
      })
      return
    }

    const orig = req.file.originalname || 'upload'
    const ext = (orig.split('.').pop() || '').toLowerCase() || 'bin'
    const contentType = req.file.mimetype || String(mimeLookup(ext) || 'application/octet-stream')
    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    const key = `uploads/${today}/${crypto.randomBytes(8).toString('hex')}.${ext}`

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: req.file.buffer,
      ACL: 'public-read',
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }))

    res.json({ url: publicUrl(BUCKET, key) })
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('[upload] error:', {
      name: e?.name, message: e?.message, code: e?.code, $metadata: e?.$metadata
    })
    res.status(500).json({
      error: 'UPLOAD_FAILED',
      name: e?.name || undefined,
      message: e?.message || String(e),
      code: e?.code || undefined,
      status: e?.$metadata?.httpStatusCode || undefined,
    })
  }
})

export default router