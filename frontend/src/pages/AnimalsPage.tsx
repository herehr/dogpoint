import React, { useEffect, useState } from 'react'
import { Container, Typography } from '@mui/material'
import { fetchAnimals } from '../services/api'

type Animal = { id: string; name?: string; jmeno?: string; description?: string; popis?: string; galerie?: { url: string }[] }

export default function AnimalsPage() {
  const [animals, setAnimals] = useState<Animal[]|null>(null)
  const [error, setError] = useState<string|null>(null)

  useEffect(() => {
    fetchAnimals().then(setAnimals).catch(e => setError(e.message || 'Chyba'))
  }, [])

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>Naši psi</Typography>
      {error && <div style={{color:'crimson'}}>Chyba: {error}</div>}
      {!animals && !error && <div>Načítám…</div>}
      {animals && <pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(animals.slice(0,1), null, 2)}</pre>}
    </Container>
  )
}
