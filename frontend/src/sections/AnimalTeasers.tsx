// frontend/src/sections/AnimalTeasers.tsx
import React from 'react'
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Container,
  Grid,
  Skeleton,
  Typography,
} from '@mui/material'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { getJSON } from '../services/api'
import type { Animal } from '../types/animal'
import SafeHTML from '../components/SafeHTML'

const FALLBACK_IMG = '/no-image.jpg'
const SPACE_CDN = 'https://dogpoint.fra1.digitaloceanspaces.com'

// ---------- helpers ----------

function stripCache(url?: string | null): string {
  if (!url) return ''
  return url.split('?')[0]
}

function isVideoUrl(url?: string | null): boolean {
  const u = String(url || '').toLowerCase()
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u)
}

function guessVideoMime(url: string): string {
  const u = (url || '').toLowerCase()
  if (u.includes('.webm')) return 'video/webm'
  return 'video/mp4'
}

function resolveMediaUrl(u?: string | null, k?: string | null): string {
  if (u) return String(u)
  if (k) return `${SPACE_CDN.replace(/\/$/, '')}/${String(k).replace(/^\//, '')}`
  return ''
}

function displayName(a: Animal): string {
  return (a.jmeno || a.name || 'Zvíře').toUpperCase()
}

function shortLine(a: Animal): string {
  const ch = (a as any).charakteristik || (a as any).charakteristika
  if (ch) return String(ch)
  const base = a.popis || a.description || ''
  const s = base.slice(0, 70)
  return base.length > 70 ? `${s}…` : s
}

function longText(a: Animal): string {
  return a.popis || a.description || 'Zobrazit detail zvířete a podat adopci.'
}

function pickMainMedia(a: Animal): { url: string; isVideo: boolean } {
  // 1) STAR wins
  const main = (a as any).main ? String((a as any).main) : ''
  if (main) return { url: main, isVideo: isVideoUrl(main) }

  // 2) from gallery: prefer VIDEO
  const gal: any[] = Array.isArray((a as any).galerie) ? (a as any).galerie : Array.isArray((a as any).gallery) ? (a as any).gallery : []

  const normalized = gal
    .map((g) => {
      const url = resolveMediaUrl(g?.url ?? null, g?.key ?? null)
      const typ = String(g?.type || g?.typ || (isVideoUrl(url) ? 'video' : 'image')).toLowerCase()
      return { url, typ, poster: g?.posterUrl || g?.poster || null }
    })
    .filter((g) => !!g.url)

  const firstVideo = normalized.find((m) => m.typ === 'video' || isVideoUrl(m.url))
  if (firstVideo?.url) return { url: firstVideo.url, isVideo: true }

  const firstAny = normalized[0]
  if (firstAny?.url) return { url: firstAny.url, isVideo: isVideoUrl(firstAny.url) }

  return { url: FALLBACK_IMG, isVideo: false }
}

// ---------- component ----------

export default function AnimalTeasers() {
  const [items, setItems] = React.useState<Animal[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const navigate = useNavigate()

  React.useEffect(() => {
    let alive = true
    getJSON<Animal[]>('/api/animals?limit=3&active=true')
      .then((data) => {
        if (alive) setItems(data || [])
      })
      .catch((e) => {
        console.error(e)
        if (alive) {
          setError('Nepodařilo se načíst zvířata.')
          setItems([])
        }
      })
    return () => {
      alive = false
    }
  }, [])

  const loading = items === null

  return (
    <Box
      id="animals-section"
      sx={{
        py: { xs: 6, md: 8 },
        background: 'linear-gradient(180deg, #fff 0%, #F4FEFE 100%)',
        scrollMarginTop: { xs: 72, md: 96 },
      }}
    >
      <Container>
        <Grid container spacing={2}>
          {loading &&
            [0, 1, 2].map((i) => (
              <Grid item xs={12} md={4} key={i}>
                <Card variant="outlined">
                  <Skeleton variant="rectangular" height={220} />
                  <CardContent>
                    <Skeleton width="60%" />
                    <Skeleton width="80%" />
                    <Skeleton />
                  </CardContent>
                  <CardActions sx={{ px: 2, pb: 2 }}>
                    <Skeleton variant="rectangular" width="100%" height={36} />
                  </CardActions>
                </Card>
              </Grid>
            ))}

          {!loading &&
            items?.map((a) => {
              const name = displayName(a)
              const { url: mainUrl, isVideo } = pickMainMedia(a)
              const detailUrl = `/zvirata/${a.id}`
              const goDetail = () => navigate(detailUrl)

              return (
                <Grid item xs={12} md={4} key={a.id}>
                  <Card
                    variant="outlined"
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'visible',
                    }}
                  >
                    <Box
                      sx={{
                        position: 'relative',
                        height: 220,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        borderTopLeftRadius: 4,
                        borderTopRightRadius: 4,
                        bgcolor: '#000',
                      }}
                      onClick={goDetail}
                    >
                      {isVideo ? (
                        <video
                          muted
                          autoPlay
                          loop
                          playsInline
                          preload="metadata"
                          controls={false}
                          style={{ width: '100%', height: 220, objectFit: 'cover', display: 'block' }}
                        >
                          <source src={mainUrl} type={guessVideoMime(mainUrl)} />
                        </video>
                      ) : (
                        <CardMedia
                          component="img"
                          height="220"
                          image={mainUrl || FALLBACK_IMG}
                          alt={name}
                          sx={{ objectFit: 'cover' }}
                        />
                      )}

                      <Button
                        onClick={(e) => {
                          e.stopPropagation()
                          goDetail()
                        }}
                        variant="contained"
                        sx={{
                          position: 'absolute',
                          left: '50%',
                          bottom: 0,
                          transform: 'translate(-50%, 50%)',
                          borderRadius: 1.5,
                          fontWeight: 900,
                          letterSpacing: 1,
                          px: 3,
                          py: 1,
                          boxShadow: 3,
                          bgcolor: 'secondary.main',
                          '&:hover': { bgcolor: 'secondary.dark' },
                        }}
                      >
                        {name}
                      </Button>
                    </Box>

                    <CardContent sx={{ flexGrow: 1, pt: 5 }}>
                      <Box
                        sx={{
                          color: 'secondary.main',
                          fontWeight: 700,
                          fontSize: 14,
                          textTransform: 'uppercase',
                          mb: 1,
                        }}
                      >
                        <SafeHTML>{shortLine(a)}</SafeHTML>
                      </Box>

                      <Box
                        sx={{
                          color: 'text.secondary',
                          display: '-webkit-box',
                          WebkitLineClamp: 8,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          mb: 1.5,
                          lineHeight: 1.6,
                        }}
                      >
                        <SafeHTML>{longText(a)}</SafeHTML>
                      </Box>
                    </CardContent>

                    <CardActions sx={{ px: 2, pb: 2 }}>
                      <Button component={RouterLink} to={detailUrl} variant="contained" fullWidth>
                        Mám zájem
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              )
            })}

          {!loading && items?.length === 0 && (
            <Grid item xs={12}>
              <Typography color="text.secondary">{error || 'Žádná zvířata k zobrazení.'}</Typography>
            </Grid>
          )}
        </Grid>
      </Container>
    </Box>
  )
}