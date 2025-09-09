// frontend/src/pages/HomePage.tsx
import React, { useEffect, useState, useMemo } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Box, Container, Typography, Button, Stack, Grid, Card, CardContent, CardMedia,
  Chip, Divider, Skeleton, Alert, Link, Snackbar
} from '@mui/material'
import PetsIcon from '@mui/icons-material/Pets'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder'
import InfoIcon from '@mui/icons-material/Info'

import { fetchAnimals } from '../services/api'

// Data contract (keeps this file self-contained; matches your shared types)
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
  const [donateOpen, setDonateOpen] = useState(false)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    fetchAnimals()
      .then((list: any[]) => {
        if (!mounted) return
        // normalize a bit (main image fallback)
        const normalized = (list || []).map((a) => {
          const gal: Media[] = a?.galerie || a?.gallery || []
          const main = a?.main || gal?.[0]?.url || '/no-image.jpg'
          return { ...a, main, galerie: gal }
        })
        // show only active on home
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
      {/* HERO (compact, mobile-first) */}
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

      {/* LATEST LIST */}
      <Container id="novinky" maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Zvířata k adopci
          </Typography>
        </Stack>

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

      {/* DONATE */}
<Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
  <Grid container spacing={4} alignItems="center">
    <Grid item xs={12} md={7}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
        Podpořte naši činnost
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Každá koruna zlepšuje život psům v naší péči. Děkujeme. ❤️
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <Button variant="contained" onClick={() => setDonateOpen(true)}>
          Jednorázový dar
        </Button>
        <Button variant="outlined" onClick={() => setDonateOpen(true)}>
          Pravidelná podpora
        </Button>
      </Stack>
    </Grid>
    <Grid item xs={12} md={5}>
      <Card variant="outlined">
        <CardContent>
          <Typography sx={{ fontWeight: 700, mb: 1 }}>Transparentní účet</Typography>
          <Typography color="text.secondary">Číslo účtu: 123456789/0100</Typography>
        </CardContent>
      </Card>
    </Grid>
  </Grid>
</Container>

<Snackbar
  open={donateOpen}
  autoHideDuration={3000}
  onClose={() => setDonateOpen(false)}
  message="Platební brána bude brzy implementována."
/>

      {/* FOOTER MINI */}
      <Box sx={{ background: '#0e1320', color: '#fff', py: 5, mt: 4 }}>
        <Container maxWidth="lg">
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                Dogpoint
              </Typography>
              <Typography sx={{ opacity: 0.85 }}>
                Pomáháme psům najít milující domov.
              </Typography>
            </Grid>
            <Grid item xs={12} md={6} textAlign={{ xs: 'left', md: 'right' }}>
              <Stack direction="row" spacing={3} sx={{ justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
                <Link component={RouterLink} to="/zvirata" sx={{ color: '#fff' }}>Psy k adopci</Link>
                <Link component={RouterLink} to="/admin/login" sx={{ color: '#fff' }}>Admin</Link>
                <Link component={RouterLink} to="/moderator/login" sx={{ color: '#fff' }}>Moderátor</Link>
              </Stack>
              <Typography sx={{ mt: 1, opacity: 0.6 }}>
                © {new Date().getFullYear()} Dogpoint
              </Typography>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </Box>
  )
}

/* =========
   Card
   ========= */
function AnimalCard({ a }: { a: Animal }) {
  const kindLabel =
    a.druh === 'pes' ? 'Pes' :
    a.druh === 'kočka' ? 'Kočka' :
    a.druh ? 'Jiné' : '—'

  const ageLabel = a.vek || 'neuvedeno'

  // description clamp (3 lines)
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