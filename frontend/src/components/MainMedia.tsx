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
  poster?: string
  mode?: 'cover' | 'contain'
  // card mode = autoplay muted loop (no controls)
  variant?: 'card' | 'detail'
}

export default function MainMedia({
  url,
  alt = '',
  height = 220,
  rounded = 12,
  poster,
  mode = 'cover',
  variant = 'card',
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

  // Video rendering
  const cardMode = variant === 'card'

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
        // Card previews: silent autoplay loop
        muted={cardMode}
        autoPlay={cardMode}
        loop={cardMode}
        playsInline
        // Detail: user-friendly controls
        controls={!cardMode}
        preload="metadata"
        poster={poster}
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