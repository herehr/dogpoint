import React, { useEffect, useState } from 'react'
import { Container, Typography, Grid } from '@mui/material'
import AnimalCard from '../components/AnimalCard'
import { fetchAnimals } from '../services/api'

type Animal = { id: string; name?: string; jmeno?: string; description?: string; popis?: string; galerie?: { url: string }[] }

export default function AnimalsPage() {
  const [animals, setAnimals] = useState<Animal[]>([])
  const [error, setError] = useState<string|null>(null)

  useEffect(() => {
    fetchAnimals().then(setAnimals).catch(e => setError(e.message || 'Chyba'))
  }, [])

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>Naši psi</Typography>
      {error && <div style={{color:'crimson'}}>Chyba: {error}</div>}
      <Grid container spacing={2}>
        {animals.map(animal => (
          <Grid item xs={12} sm={6} md={4} key={animal.id}>
            <AnimalCard
              name={animal.name || animal.jmeno || 'Bezejmenný'}
              description={animal.description || animal.popis || ''}
              image={(animal.galerie && animal.galerie[0]?.url) || '/no-image.jpg'}
            />
          </Grid>
        ))}
      </Grid>
    </Container>
  )
}
