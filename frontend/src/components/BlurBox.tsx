import React from 'react'
import { Box } from '@mui/material'

export default function BlurBox({
  blurred,
  children,
}: {
  blurred?: boolean
  children: React.ReactNode
}) {
  return (
    <Box
      sx={{
        position: 'relative',
        borderRadius: 2,
        overflow: 'hidden',
        ...(blurred
          ? {
              filter: 'blur(4px)',
              pointerEvents: 'none',
              userSelect: 'none',
            }
          : {}),
      }}
    >
      {children}
    </Box>
  )
}