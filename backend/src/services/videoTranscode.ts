import fs from 'fs'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import os from 'os'

const exec = promisify(execFile)

export type TranscodedVideo = {
  videoPath: string
  posterPath: string
}

export async function transcodeVideo(
  buffer: Buffer,
  originalName: string
): Promise<TranscodedVideo> {
  const tmpDir = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'dogpoint-video-')
  )

  const inputPath = path.join(tmpDir, originalName)
  const outputVideo = path.join(tmpDir, 'video.mp4')
  const outputPoster = path.join(tmpDir, 'poster.jpg')

  await fs.promises.writeFile(inputPath, buffer)

  // 🎬 Transcode video
  await exec('ffmpeg', [
    '-y',
    '-i', inputPath,
    '-map', '0:v:0',
    '-map', '0:a?',
    '-c:v', 'libx264',
    '-profile:v', 'high',
    '-level', '4.2',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-preset', 'fast',
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', '128k',
    outputVideo,
  ])

  // 🖼 Poster frame
  await exec('ffmpeg', [
    '-y',
    '-i', inputPath,
    '-ss', '00:00:01',
    '-vframes', '1',
    outputPoster,
  ])

  return {
    videoPath: outputVideo,
    posterPath: outputPoster,
  }
}