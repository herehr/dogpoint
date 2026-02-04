// backend/src/routes/upload.ts
import { Router, type Request, type Response } from 'express'
import multer from 'multer'
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

/** Accept only images/videos */
const fileFilter = (_req: any, file: any, cb: any) => {
  const original = String(file?.originalname || '')
  const ext = (original.split('.').pop() || '').toLowerCase()
  const mime = String(file?.mimetype || '')

  const ok =
    mime.startsWith('image/') ||
    mime.startsWith('video/') ||
    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'm4v', 'webm'].includes(ext)

  if (!ok) return cb(new Error('Unsupported file type'), false)
  return cb(null, true)
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
  fileFilter: fileFilter as any,
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
const IMG_QUALITY = 82
const MAX_VIDEO_HEIGHT = 1080
const VIDEO_PRESET = 'fast'
const VIDEO_CRF = 23
const VIDEO_AUDIO_BITRATE = '128k'

function trimSlash(s: string): string {
  return (s || '').replace(/\/+$/, '')
}

/**
 * Build a correct public URL for DigitalOcean Spaces.
 *
 * Supports BOTH:
 *  A) bucket subdomain:
 *     https://dogpoint.fra1.digitaloceanspaces.com/uploads/...
 *     https://dogpoint.fra1.cdn.digitaloceanspaces.com/uploads/...
 *
 *  B) path style:
 *     https://fra1.digitaloceanspaces.com/dogpoint/uploads/...
 *
 * IMPORTANT:
 * If DO_SPACE_PUBLIC_BASE is bucket-subdomain, we MUST NOT append "/bucket" again.
 */
function buildPublicUrl(bucket: string, key: string): string {
  const pub = trimSlash(process.env.DO_SPACE_PUBLIC_BASE || '')
  const endpoint = trimSlash(process.env.DO_SPACE_ENDPOINT || 'https://fra1.digitaloceanspaces.com')

  const b = String(bucket || '').trim()
  const k = String(key || '').replace(/^\/+/, '')
  const bb = b.toLowerCase()

  const fromBase = (base: string): string | null => {
    try {
      const u = new URL(base)
      const host = u.hostname.toLowerCase()
      const pn = u.pathname.replace(/\/+$/, '') // "" or "/dogpoint"

      // ✅ bucket as subdomain (including CDN): ignore any pathname
      // e.g. host = dogpoint.fra1.digitaloceanspaces.com
      // e.g. host = dogpoint.fra1.cdn.digitaloceanspaces.com
      if (bb && (host === `${bb}.fra1.digitaloceanspaces.com` || host === `${bb}.fra1.cdn.digitaloceanspaces.com`)) {
        return `${u.origin}/${k}`
      }
      if (bb && host.startsWith(`${bb}.`)) {
        // covers custom region subdomains too
        return `${u.origin}/${k}`
      }

      // ✅ base already includes /bucket (path style)
      if (bb && pn === `/${bb}`) return `${u.origin}${pn}/${k}`

      // ✅ endpoint style base (no bucket in path) → append /bucket
      if (bb) return `${u.origin}${pn}/${bb}/${k}`

      // fallback
      return `${u.origin}${pn}/${k}`
    } catch {
      return null
    }
  }

  if (pub) {
    const out = fromBase(pub)
    if (out) return out
  }

  const out2 = fromBase(endpoint)
  if (out2) return out2

  return `${endpoint}/${b}/${k}`
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
    // IMAGE -> normalize to JPEG
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
          ContentDisposition: 'inline',
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      )

      res.json({ type: 'image', url: buildPublicUrl(bucket, key), key })
      return
    }

    // =========================
    // VIDEO -> transcode to MP4 + poster
    // =========================
    if (isVideo) {
      const inExt = guessExtFromMime(mime, req.file.originalname)
      const { path: tmpIn, cleanup: cleanupIn } = await tmpFile({ postfix: `.${inExt}` })
      const { path: tmpOut, cleanup: cleanupOut } = await tmpFile({ postfix: '.mp4' })
      const { path: tmpPoster, cleanup: cleanupPoster } = await tmpFile({ postfix: '.jpg' })

      try {
        fs.writeFileSync(tmpIn, req.file.buffer)

        const scale = `scale='if(gt(ih,${MAX_VIDEO_HEIGHT}),-2,iw)':'if(gt(ih,${MAX_VIDEO_HEIGHT}),${MAX_VIDEO_HEIGHT},ih)'`

        // TRANSCODE MP4 (H264 + AAC) + faststart
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

        // POSTER: try 1s, fallback to 0s for short videos
        const makePosterAt = async (ts: string) => {
          await new Promise<void>((resolve, reject) => {
            const folder = path.dirname(tmpPoster)
            const filename = path.basename(tmpPoster)
            ffmpeg(tmpOut) // ✅ use transcoded file
              .on('error', (err: Error) => reject(err))
              .on('end', () => resolve())
              .screenshots({ timestamps: [ts], filename, folder })
          })
        }

        try {
          await makePosterAt('1')
        } catch {
          await makePosterAt('0')
        }

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
            ContentDisposition: 'inline',
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
            ContentDisposition: 'inline',
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