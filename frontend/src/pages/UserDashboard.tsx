import React from 'react'
import {
  Container, Typography, Grid, Card, CardContent, CardActionArea,
  CardMedia, Stack, Chip, Alert, Skeleton, Button
} from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { myAdoptedAnimals, markAnimalSeen, MyAdoptedItem } from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function UserDashboard() {
  const { user } = useAuth()
  const [items, setItems] = React.useState<MyAdoptedItem[] | null>(null)
  const [err, setErr] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let alive = true
    setLoading(true)
    setErr(null)
    myAdoptedAnimals()
      .then(list => { if (alive) setItems(list || []) })
      .catch(e => { if (alive) setErr(e?.message || 'Nepodařilo se načíst adopce') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const onSeen = async (animalId: string) => {
    try {
      await markAnimalSeen(animalId)
      // optimistic UI – nothing fancy here; could refetch if needed
    } catch (e) {
      console.warn('mark seen failed', e)
    }
  }

  return (
    <Container sx={{ py: 4 }}>
      <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 900 }}>Moje adopce</Typography>
        {user?.email && (
          <Chip label={user.email} color="default" variant="outlined" />
        )}
      </Stack>

      {loading && (
        <Grid container spacing={2}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Skeleton variant="rectangular" height={180} />
              <Skeleton variant="text" />
            </Grid>
          ))}
        </Grid>
      )}

      {!!err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      {!loading && items && items.length === 0 && (
        <Alert severity="info">
          Zatím tu nic není. Po úspěšné platbě se vaše adopce objeví zde.
        </Alert>
      )}

      {!loading && items && items.length > 0 && (
        <Grid container spacing={2}>
          {items.map((it) => {
            const title = it.title || it.jmeno || it.name || 'Zvíře'
            return (
              <Grid item xs={12} sm={6} md={4} key={it.animalId}>
                <Card>
                  <CardActionArea component={RouterLink} to={`/zvirata/${it.animalId}`} onClick={() => onSeen(it.animalId)}>
                    {it.main && (
                      <CardMedia component="img" height="160" image={it.main} alt={title} />
                    )}
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>{title}</Typography>
                        {it.status && <Chip size="small" label={it.status} />}
                      </Stack>
                      {it.since && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          od: {new Date(it.since).toLocaleDateString()}
                        </Typography>
                      )}
                      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                        <Button size="small" component={RouterLink} to={`/zvirata/${it.animalId}`}>
                          Zobrazit detail
                        </Button>
                        <Button size="small" onClick={(e) => { e.preventDefault(); onSeen(it.animalId); }}>
                          Označit jako shlédnuté
                        </Button>
                      </Stack>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            )
          })}
        </Grid>
      )}
    </Container>
  )
}