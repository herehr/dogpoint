import React, { useEffect, useState } from 'react'
import AnimalCard from '../components/AnimalCard'
import { fetchAnimals } from '../services/api'
import { Container, Typography, Grid } from '@mui/material'

interface Animal {
  id: string
  name: string
  description: string
  galerie: { url: string }[]
}

const AnimalsPage: React.FC = () => {
  const [animals, setAnimals] = useState<Animal[]>([])

  useEffect(() => {
    fetchAnimals().then(setAnimals).catch(console.error)
  }, [])

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>Naši psi</Typography>
      <Grid container spacing={2}>
        {animals.map(animal => (
          <Grid item xs={12} sm={6} md={4} key={animal.id}>
            <AnimalCard
              name={animal.name}
              description={animal.description}
              image={animal.galerie?.[0]?.url || '/no-image.jpg'}
            />
          </Grid>
        ))}
      </Grid>
    </Container>
  )
}

export default AnimalsPage