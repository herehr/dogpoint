// frontend/src/components/MainMedia.tsx
import React from 'react'
import { Box } from '@mui/material'

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url || '')
}

function guessVideoMime(url: string): string {
  const u = (url || '').toLowerCase()
  if (u.includes('.webm')) return 'video/webm'
  return 'video/mp4'
}

type Props = {
  url: string
  alt?: string
  height?: number
  rounded?: number
  mode?: 'cover' | 'contain'
  /**
   * card = small autoplay loop
   * detail = autoplay (no preview) + optionally controls (but default off)
   */
  variant?: 'card' | 'detail'
  controls?: boolean
}

export default function MainMedia({
  url,
  alt = '',
  height = 220,
  rounded = 12,
  mode = 'cover',
  variant = 'card',
  controls = false,
}: Props) {
  const isVideo = isVideoUrl(url)

  if (!isVideo) {
    return (
      <Box
        component="img"
        src={url}
        alt={alt}
        sx={{
          width: '100%',
          height,
          objectFit: mode,
          display: 'block',
          borderRadius: rounded,
        }}
      />
    )
  }

  const isCard = variant === 'card'

  return (
    <Box
      sx={{
        width: '100%',
        height,
        borderRadius: rounded,
        overflow: 'hidden',
        background: '#000',
      }}
    >
      <video
        // ✅ must be muted for autoplay to work reliably on mobile browsers
        muted
        // ✅ always autoplay so there is no "preview" state
        autoPlay
        playsInline
        // cards loop forever; detail can loop too (feels nicer for hero videos)
        loop={isCard || variant === 'detail'}
        // no preview / no poster
        poster={undefined}
        // no controls by default (you can pass controls={true} if you want)
        controls={controls}
        preload="auto"
        style={{
          width: '100%',
          height: '100%',
          objectFit: mode,
          display: 'block',
        }}
      >
        <source src={url} type={guessVideoMime(url)} />
      </video>
    </Box>
  )
}