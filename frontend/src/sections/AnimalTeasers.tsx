import React from 'react'
import {
  Box, Grid, Card, CardActionArea, CardMedia, CardContent,
  Typography, Skeleton, Alert
} from '@mui/material'

// ✅ Use the façade that exports getAnimalsTeasers + Animal type
import { getAnimalsTeasers, type Animal } from '../api'

export default function AnimalTeasers() {
  const [items, setItems] = React.useState<Animal[] | null>(null)
  const [err, setErr] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let alive = true
    setLoading(true)
    setErr(null)
    getAnimalsTeasers()
      .then(list => { if (alive) setItems(list || []) })
      .catch(e => { if (alive) setErr((e?.message || 'Nepodařilo se načíst zvířata').toString()) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  if (loading) {
    return (
      <Box sx={{ mt: 3 }}>
        <Grid container spacing={2}>
          {[0,1,2].map(i => (
            <Grid item xs={12} sm={4} key={i}>
              <Skeleton variant="rectangular" height={160} />
              <Skeleton variant="text" width="80%" sx={{ mt: 1 }} />
              <Skeleton variant="text" width="60%" />
            </Grid>
          ))}
        </Grid>
      </Box>
    )
  }

  if (err) return <Box sx={{ mt: 3 }}><Alert severity="error">{err}</Alert></Box>
  if (!items?.length) return <Box sx={{ mt: 3 }}><Typography color="text.secondary">Žádná zvířata k zobrazení.</Typography></Box>

  return (
    <Box sx={{ mt: 3 }}>
      <Grid container spacing={2}>
        {items.map(a => {
          const title = a.jmeno || a.name || '—'
          const mainUrl = (a.galerie || []).find(g => g?.url)?.url || ''
          return (
            <Grid item xs={12} sm={4} key={a.id}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardActionArea href={`/zvirata/${encodeURIComponent(a.id)}`}>
                  {mainUrl
                    ? <CardMedia component="img" height="160" image={mainUrl} alt={title} sx={{ objectFit: 'cover' }} />
                    : <Box sx={{ height: 160, bgcolor: 'grey.100' }} />
                  }
                  <CardContent>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{title}</Typography>
                    {(a.popis || a.description) && (
                      <Typography
                        variant="body2" color="text.secondary"
                        sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', mt: 0.5 }}
                      >
                        {a.popis || a.description}
                      </Typography>
                    )}
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          )
        })}
      </Grid>
    </Box>
  )
}