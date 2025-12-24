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
    file.mimetype?.startsWith('image/') ||
    file.mimetype?.startsWith('video/') ||
    ['jpg','jpeg','png','gif','webp','mp4','mov','m4v','webm'].includes(ext)
  cb(ok ? null : new Error('Unsupported file type'), ok)
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
  fileFilter,
})

/** DigitalOcean Spaces S3 client */
const s3 = new S3Client({
  region: process.env.DO_SPACE_REGION || 'us-east-1',
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

    const baseKey = `uploads/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}`

    // =========================
    // IMAGE
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

      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ACL: 'public-read',
        ContentType: 'image/jpeg',
        CacheControl: 'public, max-age=31536000, immutable',
      }))

      const base = (process.env.DO_SPACE_ENDPOINT || 'https://fra1.digitaloceanspaces.com').replace(/\/+$/, '')
      res.json({ type: 'image', url: `${base}/${bucket}/${key}` })
      return
    }

    // =========================
    // VIDEO (TRANSCODE + POSTER)
    // =========================
    if (isVideo) {
      const { path: tmpIn, cleanup: cleanupIn } = await tmpFile()
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
              '-pix_fmt yuv420p',              // ⭐ CRITICAL
              '-c:v libx264',
              `-preset ${VIDEO_PRESET}`,
              `-crf ${VIDEO_CRF}`,
              '-c:a aac',
              `-b:a ${VIDEO_AUDIO_BITRATE}`,
            ])
            .on('error', reject)
            .on('end', resolve)
            .save(tmpOut)
        })

        // 🖼 POSTER (1s)
        await new Promise<void>((resolve, reject) => {
          ffmpeg(tmpIn)
            .screenshots({
              timestamps: ['1'],
              filename: 'poster.jpg',
              folder: require('path').dirname(tmpPoster),
            })
            .on('end', resolve)
            .on('error', reject)
        })

        const videoBuffer = fs.readFileSync(tmpOut)
        const posterBuffer = fs.readFileSync(tmpPoster)

        const videoKey = `${baseKey}.mp4`
        const posterKey = `${baseKey}.jpg`

        await s3.send(new PutObjectCommand({
          Bucket: bucket,
          Key: videoKey,
          Body: videoBuffer,
          ACL: 'public-read',
          ContentType: 'video/mp4',
          CacheControl: 'public, max-age=31536000, immutable',
        }))

        await s3.send(new PutObjectCommand({
          Bucket: bucket,
          Key: posterKey,
          Body: posterBuffer,
          ACL: 'public-read',
          ContentType: 'image/jpeg',
          CacheControl: 'public, max-age=31536000, immutable',
        }))

        const base = (process.env.DO_SPACE_ENDPOINT || 'https://fra1.digitaloceanspaces.com').replace(/\/+$/, '')
        res.json({
          type: 'video',
          url: `${base}/${bucket}/${videoKey}`,
          poster: `${base}/${bucket}/${posterKey}`,
        })
        return
      } finally {
        cleanupIn().catch(() => {})
        cleanupOut().catch(() => {})
        cleanupPoster().catch(() => {})
      }
    }

    res.status(400).json({ error: 'unsupported file' })
  } catch (e: any) {
    console.error('upload error', e)
    res.status(500).json({ error: 'upload failed', detail: e?.message || String(e) })
  }
})

export default router