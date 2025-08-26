import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { fetchAnimal } from '../services/api'
import { Container, Typography, Box } from '@mui/material'
import Gallery from '../components/Gallery'

interface Animal {
  id: string
  name: string
  description: string
  galerie: { url: string }[]
}

const AnimalDetail: React.FC = () => {
  const { id } = useParams()
  const [animal, setAnimal] = useState<Animal | null>(null)

  useEffect(() => {
    if (id) fetchAnimal(id).then(setAnimal).catch(console.error)
  }, [id])

  if (!animal) return <p>Načítání...</p>

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h3" gutterBottom>{animal.name}</Typography>
      <Typography variant="body1" gutterBottom>{animal.description}</Typography>
      <Box mt={4}>
        <Gallery media={animal.galerie.map(g => g.url)} />
      </Box>
    </Container>
  )
}

export default AnimalDetail