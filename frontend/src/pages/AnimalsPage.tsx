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
  Stack,
  Typography,
} from '@mui/material'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { getAnimals } from '../api'

type Media = {
  url?: string
  key?: string
  type?: 'image' | 'video' | string
  typ?: 'image' | 'video' | string
}

type Animal = {
  id: string
  jmeno?: string
  name?: string
  popis?: string
  description?: string
  galerie?: Media[]
  gallery?: Media[]
  charakteristik?: string
  charakteristika?: string
  active?: boolean
  main?: string
}

const FALLBACK_IMG = '/no-image.jpg'
const SPACE_CDN = 'https://dogpoint.fra1.digitaloceanspaces.com'

function isVideoMedia(m?: Media | null): boolean {
  const t = String(m?.typ || m?.type || '').toLowerCase()
  if (t.includes('video')) return true
  const u = String(m?.url || m?.key || '').toLowerCase()
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u)
}

function withBust(url: string): string {
  const v = 'v=' + Date.now()
  return url.includes('?') ? `${url}&${v}` : `${url}?${v}`
}

function displayName(a: Animal): string {
  return String(a.jmeno || a.name || 'Zvíře')
}

function pickGallery(a: Animal): Media[] {
  const g = (a.galerie || a.gallery || []) as Media[]
  return Array.isArray(g) ? g : []
}

function mediaUrl(a: Animal): string {
  // Prefer explicit main if present and not a video
  if (a.main && !/\.(mp4|webm|mov|m4v)(\?|$)/i.test(a.main)) return a.main

  const gal = pickGallery(a)

  // Prefer first NON-video item
  const firstImg = gal.find((m) => !isVideoMedia(m)) || gal[0]
  if (!firstImg) return FALLBACK_IMG

  if (firstImg.url) return firstImg.url
  if (firstImg.key) {
    const base = SPACE_CDN.replace(/\/$/, '')
    const key = String(firstImg.key).replace(/^\//, '')
    return `${base}/${key}`
  }

  return FALLBACK_IMG
}

function shortLine(a: Animal): string {
  const ch = a.charakteristik || a.charakteristika
  if (ch) return String(ch)
  const base = a.popis || a.description || ''
  const s = base.slice(0, 70)
  return base.length > 70 ? `${s}…` : s
}

function longText(a: Animal): string {
  return a.popis || a.description || 'Zobrazit detail zvířete a podat adopci.'
}

export default function AnimalsPage() {
  const [items, setItems] = React.useState<Animal[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const navigate = useNavigate()

  React.useEffect(() => {
    let alive = true
    getAnimals()
      .then((list: any[]) => {
        if (!alive) return
        const normalized = (list || [])
          .map((a: any) => ({
            ...a,
            galerie: (a?.galerie || a?.gallery || []) as Media[],
          }))
          .filter((a: any) => a?.active !== false)
        setItems(normalized)
      })
      .catch((e: any) => {
        console.error(e)
        if (!alive) return
        setError('Nepodařilo se načíst zvířata.')
        setItems([])
      })
    return () => {
      alive = false
    }
  }, [])

  const loading = items === null

  return (
    <Box
      sx={{
        py: { xs: 6, md: 8 },
        background: 'linear-gradient(180deg, #fff 0%, #F4FEFE 100%)',
      }}
    >
      <Container>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography variant="h4" sx={{ fontWeight: 900 }}>
            Naši psi
          </Typography>
        </Stack>

        {error && !loading && (
          <Typography sx={{ mb: 2 }} color="error">
            {error}
          </Typography>
        )}

        <Grid container spacing={2}>
          {loading &&
            Array.from({ length: 6 }).map((_, i) => (
              <Grid item xs={12} sm={6} md={4} key={`s-${i}`}>
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
              const name = displayName(a).toUpperCase()
              const img = mediaUrl(a)
              const detailUrl = `/zvirata/${encodeURIComponent(a.id)}`
              const goDetail = () => navigate(detailUrl)

              return (
                <Grid item xs={12} sm={6} md={4} key={a.id}>
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
                        overflow: 'visible',
                        cursor: 'pointer',
                      }}
                      onClick={goDetail}
                    >
                      <CardMedia
                        component="img"
                        height="220"
                        image={withBust(img)}
                        alt={name}
                        sx={{ objectFit: 'cover' }}
                      />

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
                        }}
                      >
                        {name}
                      </Button>
                    </Box>

                    <CardContent sx={{ flexGrow: 1, pt: 5 }}>
                      <Typography
                        sx={{
                          fontWeight: 700,
                          fontSize: 14,
                          textTransform: 'uppercase',
                          mb: 1,
                        }}
                      >
                        {shortLine(a)}
                      </Typography>

                      <Typography
                        color="text.secondary"
                        sx={{
                          display: '-webkit-box',
                          WebkitLineClamp: 8,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          mb: 1.5,
                          lineHeight: 1.6,
                        }}
                      >
                        {longText(a)}
                      </Typography>
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
              <Typography color="text.secondary">Žádná zvířata k zobrazení.</Typography>
            </Grid>
          )}
        </Grid>
      </Container>
    </Box>
  )
}