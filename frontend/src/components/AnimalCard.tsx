// frontend/src/components/AnimalCard.tsx
import React from 'react'
import {
  Card,
  CardContent,
  CardMedia,
  Typography,
  Box,
} from '@mui/material'
import SafeHTML from './SafeHTML'

interface AnimalCardProps {
  name: string
  description: string // HTML / formatted text
  image: string
}

const AnimalCard: React.FC<AnimalCardProps> = ({ name, description, image }) => {
  return (
    <Card sx={{ maxWidth: 345, m: 2 }}>
      <CardMedia component="img" height="200" image={image} alt={name} />
      <CardContent>
        <Typography gutterBottom variant="h5">
          {name}
        </Typography>

        {/* formatted description (bold, italic, color, etc.) */}
        <Box sx={{ color: 'text.secondary', mt: 0.5 }}>
          <SafeHTML>{description}</SafeHTML>
        </Box>
      </CardContent>
    </Card>
  )
}

export default AnimalCard