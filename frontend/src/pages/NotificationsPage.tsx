// frontend/src/pages/NotificationsPage.tsx
import React, { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Chip,
  Container,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material'
import { useAuth } from '../context/AuthContext'
import {
  fetchMyNotifications,
  MyNotificationItem,
} from '../services/api'
import SafeHTML from '../components/SafeHTML'

const LAST_SEEN_KEY = 'dp:lastSeenNotificationTs'

export default function NotificationsPage() {
  const { token, role } = useAuth()

  const [items, setItems] = useState<MyNotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newCount, setNewCount] = useState(0)

  useEffect(() => {
    if (!token || !role) {
      setLoading(false)
      return
    }

    let alive = true

    ;(async () => {
      try {
        setLoading(true)
        setError(null)

        const data = await fetchMyNotifications()
        if (!alive) return

        setItems(data)

        const lastSeenRaw = localStorage.getItem(LAST_SEEN_KEY)
        const lastSeen = lastSeenRaw ? new Date(lastSeenRaw) : null

        const newestTs = data[0]?.publishedAt
          ? new Date(data[0].publishedAt)
          : null

        // spočítat, kolik je "nových"
        const cnt = data.filter((n) => {
          if (!lastSeen) return true
          return new Date(n.publishedAt) > lastSeen
        }).length
        setNewCount(cnt)

        // a hned označit jako "viděno" (můžeme i až při odchodu ze stránky)
        if (newestTs) {
          localStorage.setItem(LAST_SEEN_KEY, newestTs.toISOString())
        }
      } catch (e: any) {
        if (!alive) return
        console.error('[NotificationsPage] load error', e)
        setError(e?.message || 'Nepodařilo se načíst notifikace.')
      } finally {
        if (alive) setLoading(false)
      }
    })()

    return () => {
      alive = false
    }
  }, [token, role])

  if (!token) {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Alert severity="info">
          Pro zobrazení notifikací se prosím přihlaste.
        </Alert>
      </Container>
    )
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 3 }}
      >
        <Typography variant="h5" sx={{ fontWeight: 900 }}>
          Notifikace
        </Typography>
        {newCount > 0 && (
          <Chip
            color="primary"
            label={`${newCount} nových`}
            size="small"
          />
        )}
      </Stack>

      {loading && (
        <Typography color="text.secondary">Načítám notifikace…</Typography>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!loading && !error && items.length === 0 && (
        <Typography color="text.secondary">
          Nemáte žádné notifikace.
        </Typography>
      )}

      {!loading && items.length > 0 && (
        <List>
          {items.map((n) => (
            <ListItem
              key={n.id + n.animalId}
              alignItems="flex-start"
              sx={{
                borderBottom: '1px solid',
                borderColor: 'divider',
                py: 1.5,
              }}
            >
              <ListItemText
                primary={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography sx={{ fontWeight: 700 }}>
                      {n.animalName}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 500 }}
                    >
                      – {n.title}
                    </Typography>
                  </Stack>
                }
                secondary={
                  <Box sx={{ mt: 0.5 }}>
                    {n.body && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 0.5 }}
                      >
                        <SafeHTML>{n.body}</SafeHTML>
                      </Typography>
                    )}
                    <Typography
                      variant="caption"
                      color="text.secondary"
                    >
                      {new Date(n.publishedAt).toLocaleString('cs-CZ')}
                    </Typography>
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      )}
    </Container>
  )
}