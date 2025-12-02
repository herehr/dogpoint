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
import { getJSON } from '../services/api' // unified API helper
import type { Animal } from '../types/animal'
import SafeHTML from '../components/SafeHTML'   // 👈 FIXED PATH

const FALLBACK_IMG = '/no-image.jpg'
const SPACE_CDN = 'https://dogpoint.fra1.digitaloceanspaces.com' // only if server returns S3 key w/o full URL

function mediaUrl(a: Animal): string {
  const first = a.galerie?.find((g: any) => (g.type ?? g.typ) !== 'video') || a.galerie?.[0]
  if (!first) return FALLBACK_IMG
  if ((first as any).url) return (first as any).url
  if ((first as any).key) {
    return `${SPACE_CDN.replace(/\/$/, '')}/${String((first as any).key).replace(/^\//, '')}`
  }
  return FALLBACK_IMG
}

function displayName(a: Animal): string {
  return (a.jmeno || a.name || 'Zvíře').toUpperCase()
}

function shortLine(a: Animal): string {
  // prefer charakteristik → else 70 chars of description
  const ch = (a as any).charakteristik || (a as any).charakteristika
  if (ch) return String(ch)
  const base = a.popis || a.description || ''
  const s = base.slice(0, 70)
  return base.length > 70 ? `${s}…` : s
}

function longText(a: Animal): string {
  return a.popis || a.description || 'Zobrazit detail zvířete a podat adopci.'
}

export default function AnimalTeasers() {
  const [items, setItems] = React.useState<Animal[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const navigate = useNavigate()

  React.useEffect(() => {
    let alive = true
    getJSON<Animal[]>('/api/animals?limit=3&active=true')
      .then((data) => {
        if (alive) setItems(data)
      })
      .catch((e) => {
        console.error(e)
        if (alive) {
          setError('Nepodařilo se načíst zvířata.')
          setItems([]) // render “no items” state
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
              const img = mediaUrl(a)
              const goDetail = () => navigate(`/zvirata/${a.id}`)

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
                    {/* Image with overlaid Name button */}
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
                        image={img}
                        alt={name}
                        sx={{ objectFit: 'cover' }}
                      />
                      <Button
                        onClick={goDetail}
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

                    {/* Text area */}
                    <CardContent sx={{ flexGrow: 1, pt: 5 }}>
                      {/* charakteristik (accent colored short line, with HTML formatting) */}
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

                      {/* 8-line clamp of description, with HTML formatting */}
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

                    {/* Adoption CTA */}
                    <CardActions sx={{ px: 2, pb: 2 }}>
                      <Button
                        component={RouterLink}
                        to={`/zvirata/${a.id}`}
                        variant="contained"
                        fullWidth
                      >
                        Mám zájem
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              )
            })}

          {!loading && items?.length === 0 && (
            <Grid item xs={12}>
              <Typography color="text.secondary">
                {error || 'Žádná zvířata k zobrazení.'}
              </Typography>
            </Grid>
          )}
        </Grid>
      </Container>
    </Box>
  )
}