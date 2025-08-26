import React from 'react'
import { Card, CardContent, CardMedia, Typography } from '@mui/material'

interface AnimalCardProps {
  name: string
  description: string
  image: string
}

const AnimalCard: React.FC<AnimalCardProps> = ({ name, description, image }) => {
  return (
    <Card sx={{ maxWidth: 345, margin: 2 }}>
      <CardMedia component="img" height="200" image={image} alt={name} />
      <CardContent>
        <Typography gutterBottom variant="h5">{name}</Typography>
        <Typography variant="body2" color="text.secondary">{description}</Typography>
      </CardContent>
    </Card>
  )
}

export default AnimalCard