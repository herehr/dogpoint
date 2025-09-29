import React, { useEffect, useState } from 'react'
import { Container, Typography, Grid, Card, CardMedia, CardContent, Stack, Chip, Button, Alert } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { myAdoptedAnimals, markAnimalSeen, endAdoption } from '../api'

type Row = {
  animal: { id: string; jmeno: string; main: string | null; active: boolean }
  monthly: number | null
  hasNew: boolean
  latestAt: string
  lastSeenAt: string | null
}

export default function UserDashboard() {
  const [rows, setRows] = useState<Row[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const navigate = useNavigate()

  async function refresh() {
    setErr(null)
    try {
      const data = await myAdoptedAnimals()
      setRows(data)
    } catch (e: any) {
      setErr(e?.message || 'Nelze načíst vaše adopce')
    }
  }
  useEffect(() => { refresh() }, [])

  async function openAnimal(r: Row) {
    try {
      if (r.hasNew) {
        await markAnimalSeen(r.animal.id)
      }
      navigate(`/zvirata/${encodeURIComponent(r.animal.id)}`)
    } catch {
      navigate(`/zvirata/${encodeURIComponent(r.animal.id)}`)
    }
  }

  async function onEnd(animalId: string) {
    if (!confirm('Opravdu ukončit adopci?')) return
    setErr(null); setOk(null)
    try {
      await endAdoption(animalId)
      setOk('Adopce byla ukončena.')
      await refresh()
    } catch (e: any) {
      setErr(e?.message || 'Ukončení selhalo')
    }
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ fontWeight: 900, mb: 2 }}>
        Moje adopce
      </Typography>

      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
      {ok && <Alert severity="success" sx={{ mb: 2 }}>{ok}</Alert>}

      <Grid container spacing={2}>
        {rows.map((r) => (
          <Grid key={r.animal.id} item xs={12} sm={6} md={4} lg={3}>
            <Card variant="outlined" sx={{ borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
              {r.hasNew && (
                <Chip label="Novinka!" color="primary" size="small" sx={{ position: 'absolute', top: 8, left: 8 }} />
              )}
              <CardMedia component="img" image={r.animal.main || '/no-image.jpg'} alt={r.animal.jmeno} sx={{ height: 160, objectFit: 'cover' }} />
              <CardContent sx={{ flexGrow: 1 }}>
                <Stack spacing={0.5}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                    {r.animal.jmeno}
                  </Typography>
                  {r.monthly ? (
                    <Typography variant="caption" color="text.secondary">
                      {r.monthly} Kč / měsíc
                    </Typography>
                  ) : null}
                </Stack>
              </CardContent>
              <Stack direction="row" spacing={1} sx={{ p: 1.5 }}>
                <Button onClick={() => openAnimal(r)} variant="contained" size="small" sx={{ flex: 1 }}>
                  Otevřít
                </Button>
                <Button onClick={() => onEnd(r.animal.id)} color="error" variant="outlined" size="small">
                  Ukončit
                </Button>
              </Stack>
            </Card>
          </Grid>
        ))}
        {rows.length === 0 && (
          <Grid item xs={12}>
            <Typography color="text.secondary">Zatím nemáte žádné adopce.</Typography>
          </Grid>
        )}
      </Grid>
    </Container>
  )
}