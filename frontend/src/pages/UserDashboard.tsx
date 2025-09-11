import React, { useEffect, useState } from 'react'
import { Container, Typography, Grid, Card, CardMedia, CardContent, Alert } from '@mui/material'
import { useAuth } from '../context/AuthContext'
import { fetchAnimals, type Animal } from '../services/api'

export default function UserDashboard() {
  const { email } = useAuth()
  const [animals, setAnimals] = useState<Animal[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    // Keep it simple: show all animals for now; later filter by /api/adoption/me
    fetchAnimals().then(setAnimals).catch(e => setErr(e?.message || 'Chyba načítání'))
  }, [])

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h5" sx={{ fontWeight: 900, mb: 2 }}>
        Vítejte{email ? `, ${email}` : ''} 👋
      </Typography>

      <Typography variant="subtitle1" sx={{ mb: 2 }}>
        Vaše adoptovaná zvířata (a další tipy):
      </Typography>

      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      <Grid container spacing={2}>
        {animals.map(a => {
          const main = (a as any).main || a.galerie?.[0]?.url || '/no-image.jpg'
          return (
            <Grid item xs={12} sm={6} md={4} key={a.id}>
              <Card>
                <CardMedia component="img" image={main} alt={a.jmeno || 'Zvíře'} sx={{ height: 160, objectFit: 'cover' }} />
                <CardContent>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                    {a.jmeno || a.name || '—'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          )
        })}
      </Grid>
    </Container>
  )
}