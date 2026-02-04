// frontend/src/components/Gallery.tsx
import React from 'react'
import { Box } from '@mui/material'

interface GalleryProps {
  media: string[]
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url || '')
}

function guessVideoMime(url: string): string {
  const u = (url || '').toLowerCase()
  if (u.includes('.webm')) return 'video/webm'
  return 'video/mp4'
}

const Gallery: React.FC<GalleryProps> = ({ media }) => {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
      {media.map((src, index) => {
        const isVideo = isVideoUrl(src)
        return (
          <Box
            key={index}
            sx={{
              width: { xs: '100%', sm: 240 },
              height: 180,
              bgcolor: '#000',
              borderRadius: 2,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isVideo ? (
              <Box
                component="video"
                controls
                playsInline
                preload="metadata"
                sx={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  display: 'block',
                }}
              >
                <source src={src} type={guessVideoMime(src)} />
              </Box>
            ) : (
              <Box
                component="img"
                src={src}
                alt={`media-${index}`}
                sx={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            )}
          </Box>
        )
      })}
    </Box>
  )
}

export default Gallery