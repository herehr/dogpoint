// frontend/src/pages/NotificationsPage.tsx
import React from 'react'
import {
  Alert,
  Box,
  Container,
  Grid,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { MyNotificationItem, fetchMyNotifications } from '../services/api'
import { useAuth } from '../context/AuthContext'

const LAST_SEEN_KEY = 'dp:lastSeenNotificationTs'

export default function NotificationsPage() {
  const { token, role } = useAuth()
  const [items, setItems] = React.useState<MyNotificationItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!token || role !== 'USER') {
      setItems([])
      setLoading(false)
      return
    }

    let alive = true

    ;(async () => {
      try {
        const data = await fetchMyNotifications()
        if (!alive) return
        setItems(data || [])
        setError(null)

        // mark all as seen NOW → Header bell stops blinking
        try {
          localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString())
        } catch {}
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

  if (!token || role !== 'USER') {
    return (
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <Typography variant="h5" sx={{ fontWeight: 900, mb: 2 }}>
          Notifikace
        </Typography>
        <Alert severity="info">
          Pro zobrazení notifikací se prosím přihlaste jako uživatel.
        </Alert>
      </Container>
    )
  }

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Typography variant="h5" sx={{ fontWeight: 900, mb: 2 }}>
        Notifikace
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Typography color="text.secondary">Načítám…</Typography>
      ) : items.length === 0 ? (
        <Typography color="text.secondary">
          Zatím nemáte žádné notifikace.
        </Typography>
      ) : (
        <Stack spacing={2}>
          {items.map((n) => (
            <Paper
              key={`${n.animalId}-${n.id}-${n.publishedAt}`}
              variant="outlined"
              sx={{ p: 2, borderRadius: 2 }}
            >
              {/* Header: animal name + title + date */}
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="baseline"
                spacing={1}
                sx={{ mb: 1 }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 800, textTransform: 'uppercase' }}
                >
                  {n.animalName}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  {new Date(n.publishedAt).toLocaleString()}
                </Typography>
              </Stack>

              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 700, mb: 0.5 }}
              >
                {n.title}
              </Typography>

              {/* Body text (HTML from RichTextEditor in posts) */}
              {n.body && (
                <Typography
                  color="text.secondary"
                  sx={{ mb: n.media && n.media.length > 0 ? 1.5 : 0.5 }}
                  dangerouslySetInnerHTML={{ __html: n.body }}
                />
              )}

              {/* Media thumbnails (images or videos) */}
              {n.media && n.media.length > 0 && (
                <Grid container spacing={1}>
                  {n.media.map((m, idx) => {
                    const url = m.url
                    const isVideo =
                      (m.typ || '').toLowerCase() === 'video' ||
                      /\.(mp4|webm|mov|m4v)(\?|$)/.test(
                        (url || '').toLowerCase()
                      )

                    return (
                      <Grid item xs={6} sm={4} md={3} key={`${n.id}-media-${idx}`}>
                        {isVideo ? (
                          <Box
                            sx={{
                              borderRadius: 2,
                              overflow: 'hidden',
                              border: '1px solid',
                              borderColor: 'divider',
                            }}
                          >
                            <video
                              src={url}
                              controls
                              style={{
                                width: '100%',
                                height: 140,
                                objectFit: 'cover',
                                display: 'block',
                              }}
                            />
                          </Box>
                        ) : (
                          <Box
                            component="a"
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            sx={{
                              display: 'block',
                              borderRadius: 2,
                              overflow: 'hidden',
                              border: '1px solid',
                              borderColor: 'divider',
                            }}
                          >
                            <img
                              src={url}
                              alt={`media-${idx}`}
                              style={{
                                width: '100%',
                                height: 140,
                                objectFit: 'cover',
                                display: 'block',
                              }}
                            />
                          </Box>
                        )}
                      </Grid>
                    )
                  })}
                </Grid>
              )}
            </Paper>
          ))}
        </Stack>
      )}
    </Container>
  )
}