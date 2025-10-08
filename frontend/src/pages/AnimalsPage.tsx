import React, { useEffect, useState, useMemo } from 'react'
import {
  Container, Typography, Grid, Card, CardActionArea, CardMedia,
  CardContent, Chip, Skeleton, Alert, Stack, Box
} from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import SafeMarkdown from '../components/SafeMarkdown'
import { getAnimals } from '../api'

type Media = { url: string; type?: 'image' | 'video' }
type Animal = {
  id: string
  jmeno?: string
  name?: string
  popis?: string
  description?: string
  main?: string | Media
  galerie?: Media[]
  charakteristik?: string
  vek?: string
  birthDate?: string | Date | null
  bornYear?: number | null
  active?: boolean
}

function asUrl(x?: string | Media | null): string | null {
  if (!x) return null
  if (typeof x === 'string') return x
  return x.url || null
}

function pickMain(a: Animal): string {
  const u = asUrl(a.main) || asUrl(a.galerie?.[0]) || '/no-image.jpg'
  return u || '/no-image.jpg'
}

/** Match AnimalDetail: prefer full birthDate → years; else bornYear; else vek; else neuvedeno */
function formatAge(a: Animal): string {
  const bd = a.birthDate ? new Date(a.birthDate) : null
  if (bd && !Number.isNaN(bd.getTime())) {
    const now = new Date()
    let years = now.getFullYear() - bd.getFullYear()
    if (now.getMonth() < bd.getMonth() ||
        (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())) {
      years -= 1
    }
    return `${Math.max(0, years)} r`
  }
  if (a.bornYear && a.bornYear > 1900) {
    const y = new Date().getFullYear() - a.bornYear
    return `${y} r`
  }
  if (a.vek) return a.vek
  return 'neuvedeno'
}

export default function AnimalsPage() {
  const [animals, setAnimals] = useState<Animal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true); setError(null)
    getAnimals()
      .then(list => { if (alive) setAnimals(list as any) })
      .catch(e => alive && setError(e?.message || 'Chyba'))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [])

  const visible = useMemo(
    () => animals.filter(a => a.active !== false),
    [animals]
  )

  if (loading) {
    return (
      <Container sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>Naši psi</Typography>
        <Grid container spacing={2}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Card sx={{ borderRadius: 3 }}>
                <Skeleton variant="rectangular" height={160} />
                <CardContent>
                  <Skeleton width="60%" />
                  <Skeleton width="40%" />
                  <Skeleton height={32} />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    )
  }

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>Naši psi</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>Chyba: {error}</Alert>}

      <Grid container spacing={2}>
        {visible.map(a => {
          const title = a.jmeno || a.name || '—'
          const main = pickMain(a)
          const age = formatAge(a)

          return (
            <Grid item xs={12} sm={6} md={4} key={a.id}>
              <Card variant="outlined" sx={{ borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardActionArea
                  component={RouterLink}
                  to={`/animal/${a.id}`}
                  sx={{ alignItems: 'stretch' }}
                >
                  <CardMedia
                    component="img"
                    image={main}
                    alt={title}
                    sx={{ height: 180, objectFit: 'cover' }}
                    onError={(ev: any) => { ev.currentTarget.src = '/no-image.jpg' }}
                  />
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Stack spacing={1}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                        {title}
                      </Typography>

                      {/* turquoise teaser like in detail page */}
                      {a.charakteristik && (
                        <Box
                          sx={{
                            fontWeight: 700,
                            px: 1.2, py: 0.5,
                            borderRadius: 1.5,
                            display: 'inline-block',
                            bgcolor: '#00bcd4',
                            color: 'white',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                            maxWidth: '100%',
                            wordBreak: 'break-word'
                          }}
                        >
                          <SafeMarkdown>{a.charakteristik}</SafeMarkdown>
                        </Box>
                      )}

                      {/* short description (first lines only) */}
                      {(a.popis || a.description) && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}
                        >
                          {a.popis || a.description}
                        </Typography>
                      )}

                      <Chip label={age} size="small" />
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          )
        })}

        {visible.length === 0 && (
          <Grid item xs={12}>
            <Alert severity="info">Momentálně tu nejsou žádní aktivní psi.</Alert>
          </Grid>
        )}
      </Grid>
    </Container>
  )
}