import React from 'react'
import {
  Box, Button, Card, CardActions, CardContent, CardMedia,
  Container, Grid, Skeleton, Stack, Typography
} from '@mui/material'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { getAnimals } from '../api' // your existing helper

type Media = { url?: string; key?: string; type?: 'image' | 'video'; typ?: 'image' | 'video' }
type Animal = {
  id: string
  jmeno?: string
  name?: string
  popis?: string
  description?: string
  galerie?: Media[]
  charakteristik?: string
  charakteristika?: string
  active?: boolean
}

const FALLBACK_IMG = '/no-image.jpg'
const SPACE_CDN = 'https://dogpoint.fra1.digitaloceanspaces.com' // used if server sends only "key"

// Prefer first non-video; else first media; then fallback
function mediaUrl(a: Animal): string {
  const first = a.galerie?.find(g => (g.type ?? g.typ) !== 'video') || a.galerie?.[0]
  if (!first) return FALLBACK_IMG
  if (first.url) return first.url
  if (first.key) {
    return `${SPACE_CDN.replace(/\/$/, '')}/${String(first.key).replace(/^\//, '')}`
  }
  return FALLBACK_IMG
}

function displayName(a: Animal): string {
  return (a.jmeno || a.name || 'Zvíře').toUpperCase()
}

function shortLine(a: Animal): string {
  // Prefer charakteristik(a); fallback to 70 chars of description
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
      .then(list => { if (alive) setItems(list as any) })
      .catch(e => {
        console.error(e)
        if (alive) { setError('Nepodařilo se načíst zvířata.'); setItems([]) }
      })
    return () => { alive = false }
  }, [])

  const loading = items === null

  return (
    <Box sx={{ py: { xs: 6, md: 8 }, background: 'linear-gradient(180deg, #fff 0%, #F4FEFE 100%)' }}>
      <Container>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography variant="h4" sx={{ fontWeight: 900 }}>Naši psi</Typography>
          {/* If you want a filter/search later, add controls here */}
        </Stack>

        {error && !loading && (
          <Typography sx={{ mb: 2 }} color="error">{error}</Typography>
        )}

        <Grid container spacing={2}>
          {/* Loading skeletons */}
          {loading && Array.from({ length: 6 }).map((_, i) => (
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

          {/* Real items */}
          {!loading && items?.map((a) => {
            const name = displayName(a)
            const img = mediaUrl(a)
            const goDetail = () => navigate(`/zvire/${a.id}`) // <- keep in sync with your AnimalDetail route
            return (
              <Grid item xs={12} sm={6} md={4} key={a.id}>
                <Card
                  variant="outlined"
                  sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'visible' }}
                >
                  {/* Image with overlaid Name button */}
                  <Box sx={{ position: 'relative', height: 220, overflow: 'visible', cursor: 'pointer' }} onClick={goDetail}>
                    <CardMedia component="img" height="220" image={img} alt={name} sx={{ objectFit: 'cover' }} />
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
                    {/* charakteristik (accent colored short line) */}
                    <Typography
                      sx={{
                        color: 'secondary.main',
                        fontWeight: 700,
                        fontSize: 14,
                        textTransform: 'uppercase',
                        mb: 1,
                      }}
                    >
                      {shortLine(a)}
                    </Typography>

                    {/* Description clamp */}
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

                  {/* Adoption CTA */}
                  <CardActions sx={{ px: 2, pb: 2 }}>
                    <Button component={RouterLink} to={`/zvire/${a.id}`} variant="contained" fullWidth>
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