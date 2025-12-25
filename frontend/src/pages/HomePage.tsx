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
  gallery?: Media[]
  active?: boolean
}

/* ─────────────────────────────────────────────── */
/* Media helpers                                    */
/* ─────────────────────────────────────────────── */

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|m4v|mov)(\?|$)/i.test(url || '')
}

function isVideoMedia(m?: Media | null): boolean {
  if (!m?.url) return false
  const t = String(m.typ || m.type || '').toLowerCase()
  if (t.includes('video')) return true
  return isVideoUrl(m.url)
}

function guessVideoMime(url: string): string {
  const u = (url || '').toLowerCase()
  if (u.includes('.webm')) return 'video/webm'
  return 'video/mp4'
}

function stripCache(url?: string | null): string {
  if (!url) return ''
  return url.split('?')[0]
}

function withLockBust(url: string): string {
  // a simple stable bust so DO Spaces / CDN doesn't keep stale metadata
  const tag = 'h1'
  return url.includes('?') ? `${url}&v=${tag}` : `${url}?v=${tag}`
}

function pickHeroUrl(a: Animal): string {
  const gal = (a.galerie || a.gallery || []) as Media[]
  // main can be image OR video
  if (a.main) return a.main
  if (gal.length && gal[0]?.url) return gal[0].url
  return '/no-image.jpg'
}

function findPosterForUrl(a: Animal, url: string): string | undefined {
  const gal = ((a.galerie || a.gallery || []) as Media[]) || []
  const clean = stripCache(url)
  const hit = gal.find((m) => stripCache(m?.url) === clean)
  return hit?.posterUrl || hit?.poster || undefined
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
  const heroUrl = pickHeroUrl(a)
  const heroIsVideo = isVideoUrl(heroUrl) || isVideoMedia({ url: heroUrl } as any)
  const poster = heroIsVideo ? findPosterForUrl(a, heroUrl) : undefined
  const src = withLockBust(heroUrl)

  return (
    <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 3 }}>
      {heroIsVideo ? (
        // Autoplay is often blocked unless muted. For homepage cards, this is the most reliable:
        <Box sx={{ position: 'relative', width: '100%', height: 200, bgcolor: '#000' }}>
          <video
            muted
            playsInline
            autoPlay
            loop
            preload="metadata"
            poster={poster}
            controls={false}
            style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }}
          >
            <source src={src} type={guessVideoMime(src)} />
          </video>

          <Box
            sx={{
              position: 'absolute',
              bottom: 8,
              left: 8,
              px: 0.75,
              py: 0.25,
              borderRadius: 1,
              fontSize: 11,
              bgcolor: 'rgba(0,0,0,0.55)',
              color: '#fff',
              pointerEvents: 'none',
            }}
          >
            VIDEO
          </Box>
        </Box>
      ) : (
        <img
          src={src}
          alt={a.jmeno || 'Zvíře'}
          style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }}
          onError={(ev) => {
            ;(ev.currentTarget as HTMLImageElement).style.opacity = '0.35'
          }}
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