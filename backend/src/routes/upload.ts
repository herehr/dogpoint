// backend/src/routes/upload.ts
import { Router, type Request, type Response } from 'express'
import multer, { type FileFilterCallback } from 'multer'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import crypto from 'crypto'
import sharp from 'sharp'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import { file as tmpFile } from 'tmp-promise'
import fs from 'fs'
import path from 'path'

ffmpeg.setFfmpegPath(ffmpegInstaller.path)

const router = Router()

/**
 * Accept only images/videos
 * IMPORTANT: Multer typing differs between versions; this keeps it compatible.
 */
const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const ext = (file.originalname.split('.').pop() || '').toLowerCase()
  const ok =
    file.mimetype?.startsWith('image/') ||
    file.mimetype?.startsWith('video/') ||
    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'm4v', 'webm'].includes(ext)

  if (!ok) {
    // ✅ this multer typing expects `null` as first arg,
    // so we pass `null` and reject via `false`
    cb(null as any, false)
    return
  }

  cb(null as any, true)
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
  fileFilter,
})

/** DigitalOcean Spaces S3 client */
const s3 = new S3Client({
  region: process.env.DO_SPACE_REGION || 'fra1',
  endpoint: (process.env.DO_SPACE_ENDPOINT || 'https://fra1.digitaloceanspaces.com').replace(/\/+$/, ''),
  forcePathStyle: false,
  credentials: {
    accessKeyId: process.env.DO_SPACE_KEY || '',
    secretAccessKey: process.env.DO_SPACE_SECRET || '',
  },
})

/** Tunables */
const MAX_IMG = { width: 1920, height: 1920 }
const IMG_QUALITY = 80
const MAX_VIDEO_HEIGHT = 1080
const VIDEO_PRESET = 'fast'
const VIDEO_CRF = 23
const VIDEO_AUDIO_BITRATE = '128k'

function safeTrimSlash(s: string): string {
  return (s || '').replace(/\/+$/, '')
}

/**
 * Build a correct public URL for DigitalOcean Spaces.
 *
 * DO_SPACE_PUBLIC_BASE examples:
 *  - https://dogpoint.fra1.digitaloceanspaces.com   (bucket as subdomain)  ✅ best
 *  - https://fra1.digitaloceanspaces.com            (endpoint only)        -> needs /bucket/key
 */
function buildPublicUrl(bucket: string, key: string): string {
  const pub = safeTrimSlash(process.env.DO_SPACE_PUBLIC_BASE || '')
  const endpoint = safeTrimSlash(process.env.DO_SPACE_ENDPOINT || 'https://fra1.digitaloceanspaces.com')

  // If explicit public base is provided, use it:
  if (pub) {
    try {
      const u = new URL(pub)
      // bucket as subdomain? https://bucket.region.digitaloceanspaces.com
      if (u.hostname.startsWith(`${bucket}.`)) {
        return `${pub}/${key}`
      }
      // base already ends with /bucket
      if (u.pathname.replace(/\/+$/, '') === `/${bucket}`) {
        return `${pub}/${key}`
      }
      // otherwise treat as endpoint base
      return `${pub}/${bucket}/${key}`
    } catch {
      // if pub isn't a valid URL, fallback to endpoint pattern
      return `${endpoint}/${bucket}/${key}`
    }
  }

  // Default: endpoint/bucket/key
  return `${endpoint}/${bucket}/${key}`
}

function guessExtFromMime(mime: string, originalName: string): string {
  const ext = (originalName.split('.').pop() || '').toLowerCase()
  if (ext) return ext
  if (mime.includes('mp4')) return 'mp4'
  if (mime.includes('quicktime')) return 'mov'
  if (mime.includes('webm')) return 'webm'
  if (mime.includes('png')) return 'png'
  if (mime.includes('jpeg')) return 'jpg'
  return 'bin'
}

router.post('/', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'file missing' })
      return
    }

    const bucket = process.env.DO_SPACE_BUCKET
    if (!bucket) {
      res.status(500).json({ error: 'DO_SPACE_BUCKET missing' })
      return
    }

    const mime = req.file.mimetype || ''
    const isImage = mime.startsWith('image/')
    const isVideo = mime.startsWith('video/')

    const baseKey = `uploads/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}`

    // =========================
    // IMAGE -> normalize to JPG
    // =========================
    if (isImage) {
      const buffer = await sharp(req.file.buffer)
        .rotate()
        .resize({
          width: MAX_IMG.width,
          height: MAX_IMG.height,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: IMG_QUALITY, mozjpeg: true })
        .toBuffer()

      const key = `${baseKey}.jpg`

      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ACL: 'public-read',
          ContentType: 'image/jpeg',
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      )

      res.json({ type: 'image', url: buildPublicUrl(bucket, key), key })
      return
    }

    // =========================
    // VIDEO (TRANSCODE + POSTER)
    // =========================
    if (isVideo) {
      const inExt = guessExtFromMime(mime, req.file.originalname)
      const { path: tmpIn, cleanup: cleanupIn } = await tmpFile({ postfix: `.${inExt}` })
      const { path: tmpOut, cleanup: cleanupOut } = await tmpFile({ postfix: '.mp4' })
      const { path: tmpPoster, cleanup: cleanupPoster } = await tmpFile({ postfix: '.jpg' })

      try {
        fs.writeFileSync(tmpIn, req.file.buffer)

        const scale = `scale='if(gt(ih,${MAX_VIDEO_HEIGHT}),-2,iw)':'if(gt(ih,${MAX_VIDEO_HEIGHT}),${MAX_VIDEO_HEIGHT},ih)'`

        // 🎬 TRANSCODE
        await new Promise<void>((resolve, reject) => {
          ffmpeg(tmpIn)
            .outputOptions([
              '-movflags +faststart',
              `-vf ${scale}`,
              '-pix_fmt yuv420p',
              '-c:v libx264',
              `-preset ${VIDEO_PRESET}`,
              `-crf ${VIDEO_CRF}`,
              '-c:a aac',
              `-b:a ${VIDEO_AUDIO_BITRATE}`,
            ])
            .on('error', (err: Error) => reject(err))
            .on('end', () => resolve())
            .save(tmpOut)
        })

        // 🖼 POSTER at 1s
        await new Promise<void>((resolve, reject) => {
          const folder = path.dirname(tmpPoster)
          const filename = path.basename(tmpPoster)

          ffmpeg(tmpIn)
            .on('error', (err: Error) => reject(err))
            .on('end', () => resolve())
            .screenshots({
              timestamps: ['1'],
              filename,
              folder,
            })
        })

        const videoBuffer = fs.readFileSync(tmpOut)
        const posterBuffer = fs.readFileSync(tmpPoster)

        const videoKey = `${baseKey}.mp4`
        const posterKey = `${baseKey}.jpg`

        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: videoKey,
            Body: videoBuffer,
            ACL: 'public-read',
            ContentType: 'video/mp4',
            CacheControl: 'public, max-age=31536000, immutable',
          }),
        )

        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: posterKey,
            Body: posterBuffer,
            ACL: 'public-read',
            ContentType: 'image/jpeg',
            CacheControl: 'public, max-age=31536000, immutable',
          }),
        )

        res.json({
          type: 'video',
          url: buildPublicUrl(bucket, videoKey),
          key: videoKey,
          poster: buildPublicUrl(bucket, posterKey),
          posterKey,
        })
        return
      } finally {
        cleanupIn().catch(() => {})
        cleanupOut().catch(() => {})
        cleanupPoster().catch(() => {})
      }
    }

    res.status(400).json({ error: 'unsupported file' })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('upload error', e)
    res.status(500).json({ error: 'upload failed', detail: msg })
  }
})

export default router