// frontend/src/pages/HomePage.tsx
import React, { useEffect, useState, useMemo } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Box, Container, Typography, Button, Stack, Grid, Card, CardContent, CardMedia,
  Chip, Divider, Skeleton, Alert
} from '@mui/material'
import PetsIcon from '@mui/icons-material/Pets'
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder'
import InfoIcon from '@mui/icons-material/Info'
import { fetchAnimals } from '../services/api'

type Media = { url: string; type?: 'image' | 'video' }
type Animal = {
  id: string
  jmeno: string
  druh?: 'pes' | 'kočka' | 'jiné'
  vek?: string
  popis?: string
  main?: string
  galerie?: Media[]
  active?: boolean
}

export default function HomePage() {
  const [animals, setAnimals] = useState<Animal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    fetchAnimals()
      .then((list: any[]) => {
        if (!mounted) return
        const normalized = (list || []).map((a) => {
          const gal: Media[] = a?.galerie || a?.gallery || []
          const main = a?.main || gal?.[0]?.url || '/no-image.jpg'
          return { ...a, main, galerie: gal }
        })
        setAnimals(normalized.filter((a: any) => a?.active !== false))
      })
      .catch((e: any) => {
        if (!mounted) return
        setError(e?.message || 'Nepodařilo se načíst seznam zvířat.')
      })
      .finally(() => mounted && setLoading(false))
    return () => { mounted = false }
  }, [])

  const latest = useMemo(() => animals.slice(0, 12), [animals])

  return (
    <Box>
   {/* HERO */}
<Box sx={{ background: 'linear-gradient(135deg, #f6f8ff 0%, #fff 60%)', borderBottom: '1px solid #eef0f7' }}>
  <Container maxWidth="lg" sx={{ py: { xs: 5, md: 8 } }}>
    <Stack spacing={2}>
      <Typography component="h1" variant="h4" sx={{ fontWeight: 900, lineHeight: 1.2 }}>
        Dejte psům nový domov. <br />Oni vám dají srdce. ❤️
      </Typography>
      <Typography color="text.secondary" sx={{ maxWidth: 720 }}>
        Prohlédněte si psy připravené k adopci. U každého najdete krátký popis, druh a věk.
      </Typography>
    </Stack>
  </Container>
</Box>

      {/* LIST */}
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        <Typography variant="h5" sx={{ fontWeight: 900, mb: 2 }}>
          Zvířata k adopci
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Grid container spacing={2}>
          {loading &&
            Array.from({ length: 6 }).map((_, i) => (
              <Grid item xs={12} sm={6} md={4} key={`s-${i}`}>
                <Card variant="outlined" sx={{ borderRadius: 3 }}>
                  <Skeleton variant="rectangular" height={200} />
                  <CardContent>
                    <Skeleton width="60%" />
                    <Skeleton width="90%" />
                    <Skeleton width="40%" />
                  </CardContent>
                </Card>
              </Grid>
            ))}

          {!loading && latest.length === 0 && (
            <Grid item xs={12}>
              <Typography color="text.secondary">
                Aktuálně zde nejsou žádná zvířata k adopci.
              </Typography>
            </Grid>
          )}

          {!loading &&
            latest.map((a) => (
              <Grid item xs={12} sm={6} md={4} key={a.id}>
                <AnimalCard a={a} />
              </Grid>
            ))}
        </Grid>
      </Container>

      {/* FOOTER MINI */}
      <Box sx={{ background: '#0e1320', color: '#fff', py: 5, mt: 4 }}>
        <Container maxWidth="lg">
          <Typography sx={{ opacity: 0.7 }}>
            © {new Date().getFullYear()} Dogpoint
          </Typography>
        </Container>
      </Box>
    </Box>
  )
}

function AnimalCard({ a }: { a: Animal }) {
  const kindLabel =
    a.druh === 'pes' ? 'Pes' :
    a.druh === 'kočka' ? 'Kočka' :
    a.druh ? 'Jiné' : '—'
  const ageLabel = a.vek || 'neuvedeno'
  const desc = a.popis || ''

  return (
    <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 3 }}>
      <CardMedia
        component="img"
        image={a.main || a.galerie?.[0]?.url || '/no-image.jpg'}
        alt={a.jmeno || 'Zvíře'}
        sx={{ height: 200, objectFit: 'cover' }}
      />
      <CardContent sx={{ flexGrow: 1 }}>
        <Stack spacing={1}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            {a.jmeno}
          </Typography>

          <Stack direction="row" spacing={1} alignItems="center">
            <Chip size="small" icon={<PetsIcon />} label={kindLabel} />
            <Chip size="small" label={ageLabel} />
          </Stack>

          <Typography
            color="text.secondary"
            sx={{
              mt: 0.5,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
            title={desc}
          >
            {desc || 'Bez popisu.'}
          </Typography>
        </Stack>
      </CardContent>

      <Divider />
      <Stack direction="row" spacing={1} sx={{ p: 1.5 }}>
        <Button
          component={RouterLink}
          to={`/zvirata/${encodeURIComponent(a.id)}`}
          variant="contained"
          size="small"
          startIcon={<InfoIcon />}
          sx={{ flex: 1 }}
        >
          Detail
        </Button>
        <Button
          component={RouterLink}
          to={`/zvirata/${encodeURIComponent(a.id)}#adopce`}
          variant="outlined"
          size="small"
          startIcon={<FavoriteBorderIcon />}
          sx={{ flex: 1 }}
        >
          Chci adoptovat
        </Button>
      </Stack>
    </Card>
  )
}