import React from 'react'
import { useNavigate, Link as RouterLink } from 'react-router-dom'
import {
  Box, Container, Typography, Stack, Card, CardContent,
  CardActionArea, Chip, Alert, Skeleton, Button
} from '@mui/material'
import { myAdoptedAnimals, markAnimalSeen, MyAdoptedItem } from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function UserDashboard() {
  const nav = useNavigate()
  const { token } = useAuth()
  const [items, setItems] = React.useState<MyAdoptedItem[] | null>(null)
  const [err, setErr] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        const data = await myAdoptedAnimals()
        if (!alive) return
        setItems(data || [])
        // mark all seen (best-effort)
        for (const it of data || []) {
          try { if (it.animal?.id) await markAnimalSeen(it.animal.id) } catch {}
        }
      } catch (e: any) {
        if (!alive) return
        setErr(e?.message || 'Nepodařilo se načíst seznam adopcí.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [token])

  // Optional “welcome” after password set
  const welcome = React.useMemo(() => {
    try {
      const v = localStorage.getItem('dp:welcomeAfterPassword')
      if (v) localStorage.removeItem('dp:welcomeAfterPassword')
      return !!v
    } catch { return false }
  }, [])

  return (
    <Container sx={{ py: 4 }}>
      <Stack spacing={2} sx={{ mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 900 }}>
          Moje adopce
        </Typography>
        {welcome && (
          <Alert severity="success">Účet je připraven. Děkujeme za podporu!</Alert>
        )}
        {err && <Alert severity="error">{err}</Alert>}
      </Stack>

      {loading ? (
        <Stack spacing={2}>
          <Skeleton variant="rounded" height={96} />
          <Skeleton variant="rounded" height={96} />
        </Stack>
      ) : !items || items.length === 0 ? (
        <Stack spacing={2} alignItems="flex-start">
          <Typography color="text.secondary">Zatím zde nic není.</Typography>
          <Button component={RouterLink} to="/zvirata" variant="contained">
            Vybrat zvíře k adopci
          </Button>
        </Stack>
      ) : (
        <Stack spacing={2}>
          {items.map((it, idx) => {
            const a = it.animal
            const title = a?.jmeno || a?.name || '—'
            const thumb = a?.main || ''
            return (
              <Card key={`${a?.id || 'x'}-${idx}`} variant="outlined">
                <CardActionArea onClick={() => a?.id && nav(`/zvirata/${a.id}`)}>
                  <CardContent>
                    <Stack direction="row" spacing={2} alignItems="center">
                      {thumb ? (
                        <Box component="img" src={thumb} alt="" sx={{ width: 88, height: 66, objectFit: 'cover', borderRadius: 1, border: '1px solid', borderColor: 'divider' }} />
                      ) : (
                        <Box sx={{ width: 88, height: 66, bgcolor: 'grey.100', borderRadius: 1 }} />
                      )}
                      <Stack flex={1} spacing={0.5}>
                        <Typography sx={{ fontWeight: 800 }}>{title}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {it.monthly ? `Měsíční dar: ${it.monthly} Kč` : 'Jednorázový dar'}
                        </Typography>
                      </Stack>
                      {it.hasNew && <Chip color="primary" label="Novinky" />}
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            )
          })}
        </Stack>
      )}
    </Container>
  )
}