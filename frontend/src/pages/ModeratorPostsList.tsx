// frontend/src/pages/ModeratorPostsList.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Container,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { Link, useSearchParams } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

type PostMedia = {
  id: string
  url: string
  typ?: string
  type?: string
  poster?: string | null
  posterUrl?: string | null
}

type Animal = {
  id: string
  jmeno?: string | null
  name?: string | null
}

type PendingPost = {
  id: string
  title: string
  body?: string | null
  status: 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED'
  createdAt: string
  animalId: string
  animal?: Animal | null
  media?: PostMedia[]
}

function isVideoMedia(m: PostMedia): boolean {
  const t = String(m.typ || m.type || '').toLowerCase()
  if (t.includes('video')) return true
  return /\.(mp4|webm|m4v|mov)(\?|$)/i.test(m.url || '')
}

function guessVideoMime(url: string): string {
  const u = (url || '').toLowerCase()
  if (u.includes('.webm')) return 'video/webm'
  // we always prefer mp4 after transcode; for old files still try mp4
  return 'video/mp4'
}

export default function ModeratorPostsList() {
  const [params] = useSearchParams()
  const tab = (params.get('tab') || 'pending').toLowerCase()

  const [items, setItems] = useState<PendingPost[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // For now we only implement the pending queue,
  // because backend currently has /api/posts/pending ready.
  const isPendingTab = tab === 'pending'

  const token = useMemo(() => sessionStorage.getItem('moderatorToken'), [])

  const load = useCallback(async () => {
    setError(null)
    setSuccess(null)

    if (!token) {
      setError('Nejste přihlášen jako moderátor/admin. Přihlaste se prosím znovu.')
      return
    }

    if (!isPendingTab) {
      // until we add backend endpoints for approved/rejected
      setItems([])
      return
    }

    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/posts/pending`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        const txt = await res.text()
        throw new Error(`Načtení čekajících příspěvků selhalo (${res.status}): ${txt}`)
      }

      const data = (await res.json()) as PendingPost[]
      setItems(Array.isArray(data) ? data : [])
    } catch (e: any) {
      console.error('[ModeratorPostsList] load error', e)
      setError(e?.message || 'Nepodařilo se načíst čekající příspěvky.')
    } finally {
      setLoading(false)
    }
  }, [token, isPendingTab])

  useEffect(() => {
    load()
  }, [load])

  const approve = async (postId: string) => {
    setError(null)
    setSuccess(null)

    if (!token) {
      setError('Nejste přihlášen jako moderátor/admin. Přihlaste se prosím znovu.')
      return
    }

    try {
      const res = await fetch(`${API_BASE}/posts/${encodeURIComponent(postId)}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        const txt = await res.text()
        throw new Error(`Schválení selhalo (${res.status}): ${txt}`)
      }

      setSuccess('Příspěvek byl schválen.')
      await load()
    } catch (e: any) {
      console.error('[ModeratorPostsList] approve error', e)
      setError(e?.message || 'Nepodařilo se schválit příspěvek.')
    }
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 900 }}>
          Příspěvky ke schválení
        </Typography>

        <Button component={Link} to="/moderator/posts/novy" variant="contained">
          Nový příspěvek
        </Button>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Button
          component={Link}
          to="/moderator/posts?tab=pending"
          variant={tab === 'pending' ? 'contained' : 'outlined'}
        >
          Ke schválení
        </Button>
        <Button
          component={Link}
          to="/moderator/posts?tab=approved"
          variant={tab === 'approved' ? 'contained' : 'outlined'}
        >
          Schválené
        </Button>
        <Button
          component={Link}
          to="/moderator/posts?tab=rejected"
          variant={tab === 'rejected' ? 'contained' : 'outlined'}
        >
          Zamítnuté
        </Button>
      </Stack>

      {!isPendingTab && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Záložky „Schválené“ a „Zamítnuté“ doplníme po přidání backend endpointů.
          Zatím funguje „Ke schválení“.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
        <Button variant="outlined" onClick={load} disabled={loading || !isPendingTab}>
          {loading ? 'Načítám…' : 'Obnovit'}
        </Button>
        <Typography color="text.secondary" sx={{ alignSelf: 'center' }}>
          {isPendingTab ? `Čeká: ${items.length}` : ''}
        </Typography>
      </Stack>

      {isPendingTab && items.length === 0 && !loading && (
        <Paper sx={{ p: 3 }}>
          <Typography sx={{ fontWeight: 700 }}>Žádné příspěvky ke schválení.</Typography>
          <Typography color="text.secondary">
            Pokud moderátor právě vytvořil příspěvek, zkontroluj, že má status „PENDING_REVIEW“ a že jsi na správném backendu.
          </Typography>
        </Paper>
      )}

      {isPendingTab &&
        items.map((p) => {
          const animalName = p.animal?.jmeno || p.animal?.name || p.animalId
          const created = new Date(p.createdAt).toLocaleDateString('cs-CZ')

          return (
            <Paper key={p.id} sx={{ p: 2, mb: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                <Box>
                  <Typography sx={{ fontWeight: 900, fontSize: 18 }}>{p.title}</Typography>
                  <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                    Zvíře: <b>{animalName}</b> · Vytvořeno: {created}
                  </Typography>
                </Box>

                <Button variant="contained" onClick={() => approve(p.id)}>
                  Schválit
                </Button>
              </Stack>

              <Divider sx={{ my: 2 }} />

              {p.body ? (
                <Box
                  sx={{
                    '& img': { maxWidth: '100%' },
                    '& video': { maxWidth: '100%' },
                  }}
                  dangerouslySetInnerHTML={{ __html: p.body }}
                />
              ) : (
                <Typography color="text.secondary">Bez textu.</Typography>
              )}

              {p.media && p.media.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography sx={{ fontWeight: 800, mb: 1 }}>Média</Typography>

                  <Stack spacing={1}>
                    {p.media.map((m) => {
                      const isVideo = isVideoMedia(m)
                      const poster = m.posterUrl || m.poster || undefined

                      return (
                        <Box key={m.id}>
                          {isVideo ? (
                            <video
                              controls
                              preload="metadata"
                              poster={poster}
                              style={{ width: '100%', borderRadius: 8 }}
                            >
                              <source src={m.url} type={guessVideoMime(m.url)} />
                            </video>
                          ) : (
                            <img src={m.url} alt="" style={{ width: '100%', borderRadius: 8 }} />
                          )}
                        </Box>
                      )
                    })}
                  </Stack>
                </>
              )}
            </Paper>
          )
        })}
    </Container>
  )
}