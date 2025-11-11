import { Router, type Request, type Response } from 'express'
import multer from 'multer'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { lookup as mimeLookup } from 'mime-types'
import crypto from 'crypto'
import sharp from 'sharp'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import { file as tmpFile } from 'tmp-promise'
import fs from 'fs'

ffmpeg.setFfmpegPath(ffmpegInstaller.path)

const router = Router()

/** Accept only images/videos */
const fileFilter = (_req: Request, file: Express.Multer.File, cb: any) => {
  const ext = (file.originalname.split('.').pop() || '').toLowerCase()
  const ok =
    (file.mimetype?.startsWith('image/') || file.mimetype?.startsWith('video/')) ||
    ['jpg','jpeg','png','gif','webp','mp4','mov','m4v','webm'].includes(ext)
  cb(ok ? null : new Error('Unsupported file type'), ok)
}

/** Raise limit a bit to allow raw videos; we’ll shrink them. */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
  fileFilter,
})

/** DigitalOcean Spaces S3 client */
const s3 = new S3Client({
  region: process.env.DO_SPACE_REGION || 'us-east-1', // signing region
  endpoint: (process.env.DO_SPACE_ENDPOINT || 'https://fra1.digitaloceanspaces.com').replace(/\/+$/, ''),
  forcePathStyle: false,
  credentials: {
    accessKeyId: process.env.DO_SPACE_KEY || '',
    secretAccessKey: process.env.DO_SPACE_SECRET || '',
  },
})

router.get('/selftest', async (_req: Request, res: Response) => {
  try {
    const bucket = process.env.DO_SPACE_BUCKET
    if (!bucket) return res.status(500).json({ ok: false, error: 'DO_SPACE_BUCKET missing' })
    await s3.config.region()
    res.json({
      ok: true,
      bucket,
      endpoint: process.env.DO_SPACE_ENDPOINT || 'https://fra1.digitaloceanspaces.com',
    })
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.name || 'UnknownError', message: e?.message })
  }
})

/** Tunables */
const MAX_IMG = { width: 1920, height: 1920 }
const IMG_QUALITY = 80
const MAX_VIDEO_HEIGHT = 1080
const VIDEO_PRESET = 'veryfast'
const VIDEO_CRF = 23
const VIDEO_AUDIO_BITRATE = '128k'

router.post('/', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) { res.status(400).json({ error: 'file missing' }); return }
    const bucket = process.env.DO_SPACE_BUCKET
    if (!bucket) { res.status(500).json({ error: 'Server misconfigured: DO_SPACE_BUCKET missing' }); return }

    const mime = req.file.mimetype || ''
    const isImage = /^image\//.test(mime)
    const isVideo = /^video\//.test(mime)

    // Build a key; we’ll decide extension per output format
    const baseKey = `uploads/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}`
    let outBuffer: Buffer | null = null
    let outContentType = 'application/octet-stream'
    let outKey = `${baseKey}.bin`

    if (isImage) {
      // ---- IMAGE SHRINK ----
      outBuffer = await sharp(req.file.buffer)
        .rotate() // EXIF orientation
        .resize({
          width: MAX_IMG.width,
          height: MAX_IMG.height,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: IMG_QUALITY, mozjpeg: true }) // pick .webp() if you prefer
        .toBuffer()

      outContentType = 'image/jpeg'
      outKey = `${baseKey}.jpg`
    } else if (isVideo) {
      // ---- VIDEO TRANSCODE ----
      const { path: tmpIn, cleanup: cleanupIn } = await tmpFile()
      const { path: tmpOut, cleanup: cleanupOut } = await tmpFile({ postfix: '.mp4' })
      try {
        fs.writeFileSync(tmpIn, req.file.buffer)

        // Scale: cap height to MAX_VIDEO_HEIGHT, keep aspect; -2 makes width even.
        const scale = `scale='if(gt(ih,${MAX_VIDEO_HEIGHT}),-2,iw)':'if(gt(ih,${MAX_VIDEO_HEIGHT}),${MAX_VIDEO_HEIGHT},ih)'`

        await new Promise<void>((resolve, reject) => {
          ffmpeg(tmpIn)
            .outputOptions([
              '-movflags +faststart',
              `-vf ${scale}`,
              `-c:v libx264`,
              `-preset ${VIDEO_PRESET}`,
              `-crf ${VIDEO_CRF}`,
              `-c:a aac`,
              `-b:a ${VIDEO_AUDIO_BITRATE}`,
            ])
            .on('error', reject)
            .on('end', () => resolve())
            .save(tmpOut)
        })

        outBuffer = fs.readFileSync(tmpOut)
        outContentType = 'video/mp4'
        outKey = `${baseKey}.mp4`
      } finally {
        cleanupIn().catch(() => {})
        cleanupOut().catch(() => {})
      }
    } else {
      // fallback: store as-is (shouldn’t happen due to filter)
      outBuffer = req.file.buffer
      const ext = (req.file.originalname.split('.').pop() || 'bin').toLowerCase()
      outContentType = String(mime || mimeLookup(ext) || 'application/octet-stream')
      outKey = `${baseKey}.${ext}`
    }

    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: outKey,
      Body: outBuffer!,
      ACL: 'public-read',
      ContentType: outContentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }))

    const base = (process.env.DO_SPACE_ENDPOINT || 'https://fra1.digitaloceanspaces.com').replace(/\/+$/, '')
    const url = `${base}/${bucket}/${outKey}`
    res.json({ url })
  } catch (e: any) {
    console.error('upload error', e)
    res.status(500).json({ error: 'upload failed', detail: e?.message || String(e) })
  }
})

export default router