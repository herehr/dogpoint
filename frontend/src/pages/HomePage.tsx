// frontend/src/pages/HomePage.tsx
import React, { useEffect, useState, useMemo } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Box,
  Container,
  Typography,
  Button,
  Stack,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Divider,
  Skeleton,
  Alert,
} from '@mui/material'
import PetsIcon from '@mui/icons-material/Pets'
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder'
import InfoIcon from '@mui/icons-material/Info'
import { getAnimals } from '../api'

/* ─────────────────────────────────────────────── */
/* Types                                           */
/* ─────────────────────────────────────────────── */

type Media = {
  url: string
  type?: 'image' | 'video' | string
  typ?: 'image' | 'video' | string
  poster?: string | null
  posterUrl?: string | null
}

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

/* ─────────────────────────────────────────────── */
/* Media helpers (CRITICAL for Chrome)              */
/* ─────────────────────────────────────────────── */

function isVideoMedia(m?: Media | null): boolean {
  if (!m?.url) return false
  const t = String(m.typ || m.type || '').toLowerCase()
  if (t.includes('video')) return true
  return /\.(mp4|webm|m4v|mov)(\?|$)/i.test(m.url)
}

function guessVideoMime(url: string): string {
  const u = (url || '').toLowerCase()
  if (u.endsWith('.webm')) return 'video/webm'
  // your backend transcodes → mp4/h264
  return 'video/mp4'
}

function pickHeroMedia(a: Animal): Media | undefined {
  const gal = a.galerie || []
  if (!gal.length && a.main) return { url: a.main }
  return gal[0]
}

/* ─────────────────────────────────────────────── */
/* Page                                            */
/* ─────────────────────────────────────────────── */

export default function HomePage() {
  const [animals, setAnimals] = useState<Animal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)

    getAnimals()
      .then((list: any[]) => {
        if (!mounted) return
        const normalized = (list || []).map((a) => ({
          ...a,
          galerie: a?.galerie || a?.gallery || [],
        }))
        setAnimals(normalized.filter((a: any) => a?.active !== false))
      })
      .catch((e: any) => {
        if (!mounted) return
        setError(e?.message || 'Nepodařilo se načíst seznam zvířat.')
      })
      .finally(() => mounted && setLoading(false))

    return () => {
      mounted = false
    }
  }, [])

  const latest = useMemo(() => animals.slice(0, 12), [animals])

  return (
    <Box>
      {/* HERO */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #f6f8ff 0%, #fff 60%)',
          borderBottom: '1px solid #eef0f7',
        }}
      >
        <Container maxWidth="lg" sx={{ py: { xs: 5, md: 8 } }}>
          <Stack spacing={2}>
            <Typography component="h1" variant="h4" sx={{ fontWeight: 900 }}>
              Dejte psům nový domov.
              <br />
              Oni vám dají srdce. ❤️
            </Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 720 }}>
              Prohlédněte si psy připravené k adopci.
            </Typography>
          </Stack>
        </Container>
      </Box>

      {/* LIST */}
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        <Typography variant="h5" sx={{ fontWeight: 900, mb: 2 }}>
          Zvířata k adopci
        </Typography>

        {error && <Alert severity="error">{error}</Alert>}

        <Grid container spacing={2}>
          {loading &&
            Array.from({ length: 6 }).map((_, i) => (
              <Grid item xs={12} sm={6} md={4} key={i}>
                <Card variant="outlined" sx={{ borderRadius: 3 }}>
                  <Skeleton variant="rectangular" height={200} />
                  <CardContent>
                    <Skeleton width="60%" />
                    <Skeleton width="90%" />
                  </CardContent>
                </Card>
              </Grid>
            ))}

          {!loading &&
            latest.map((a) => (
              <Grid item xs={12} sm={6} md={4} key={a.id}>
                <AnimalCard a={a} />
              </Grid>
            ))}
        </Grid>
      </Container>
    </Box>
  )
}

/* ─────────────────────────────────────────────── */
/* Card                                            */
/* ─────────────────────────────────────────────── */

function AnimalCard({ a }: { a: Animal }) {
  const media = pickHeroMedia(a)
  const isVideo = isVideoMedia(media)
  const poster = media?.posterUrl || media?.poster || undefined

  return (
    <Card
      variant="outlined"
      sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 3 }}
    >
      {isVideo ? (
        <video
          controls
          preload="metadata"
          playsInline
          poster={poster}
          style={{ width: '100%', height: 200, objectFit: 'cover' }}
        >
          <source src={media!.url} type={guessVideoMime(media!.url)} />
        </video>
      ) : (
        <CardMedia
          component="img"
          image={media?.url || '/no-image.jpg'}
          alt={a.jmeno}
          sx={{ height: 200, objectFit: 'cover' }}
        />
      )}

      <CardContent sx={{ flexGrow: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          {a.jmeno}
        </Typography>

        <Stack direction="row" spacing={1} sx={{ my: 1 }}>
          <Chip size="small" icon={<PetsIcon />} label={a.druh || '—'} />
          <Chip size="small" label={a.vek || 'neuvedeno'} />
        </Stack>

        <Typography
          color="text.secondary"
          sx={{
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {a.popis || 'Bez popisu.'}
        </Typography>
      </CardContent>

      <Divider />

      <Stack direction="row" spacing={1} sx={{ p: 1.5 }}>
        <Button
          component={RouterLink}
          to={`/zvirata/${a.id}`}
          variant="contained"
          size="small"
          startIcon={<InfoIcon />}
          sx={{ flex: 1 }}
        >
          Detail
        </Button>
        <Button
          component={RouterLink}
          to={`/zvirata/${a.id}#adopce`}
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