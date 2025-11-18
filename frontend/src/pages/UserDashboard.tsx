// frontend/src/pages/UserDashboard.tsx
import React from 'react'
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  CardMedia,
  Stack,
  Chip,
  Alert,
  Skeleton,
  Button,
} from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
// NOTE: if in your project these come from "../api", adjust import accordingly.
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
      .then((list) => {
        if (!alive) return
        setItems(list || [])
      })
      .catch((e: any) => {
        if (!alive) return
        const msg = (e?.message || '').toString()

        // 👉 If backend returns 404 / "Not Found", treat it as "no adoptions yet"
        if (msg.toLowerCase().includes('not found') || msg.includes('404')) {
          setItems([])
          setErr(null)
        } else {
          setErr(msg || 'Nepodařilo se načíst adopce')
        }
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [])

  const onSeen = async (animalId: string) => {
    try {
      await markAnimalSeen(animalId)
    } catch {
      // silent fail is OK here – UX detail only
    }
  }

  return (
    <Container sx={{ py: 4 }}>
      <Stack
        direction="row"
        alignItems="baseline"
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Typography variant="h4" sx={{ fontWeight: 900 }}>
          Moje adopce
        </Typography>
        {user?.email && <Chip label={user.email} variant="outlined" />}
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

      {!!err && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {err}
        </Alert>
      )}

      {!loading && items && items.length === 0 && !err && (
        <Alert severity="info">
          Zatím tu nic není. Po úspěšné platbě se vaše adopce objeví zde.
        </Alert>
      )}

      {!loading && items && items.length > 0 && (
        <Grid container spacing={2}>
          {items.map((it) => {
            const title = (it as any).title || (it as any).jmeno || (it as any).name || 'Zvíře'
            const main = (it as any).main
            const since = (it as any).since
            const status = (it as any).status
            const animalId = (it as any).animalId

            return (
              <Grid item xs={12} sm={6} md={4} key={animalId}>
                <Card>
                  <CardActionArea
                    component={RouterLink}
                    to={`/zvirata/${animalId}`}
                    onClick={() => onSeen(animalId)}
                  >
                    {main && (
                      <CardMedia
                        component="img"
                        height="160"
                        image={main}
                        alt={title}
                      />
                    )}
                    <CardContent>
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>
                          {title}
                        </Typography>
                        {status && <Chip size="small" label={status} />}
                      </Stack>

                      {since && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mt: 0.5 }}
                        >
                          od:{' '}
                          {new Date(since).toLocaleDateString('cs-CZ', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </Typography>
                      )}

                      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                        <Button
                          size="small"
                          component={RouterLink}
                          to={`/zvirata/${animalId}`}
                        >
                          Zobrazit detail
                        </Button>
                        <Button
                          size="small"
                          onClick={(e) => {
                            e.preventDefault()
                            onSeen(animalId)
                          }}
                        >
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