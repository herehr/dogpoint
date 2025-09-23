// frontend/src/pages/AnimalDetail.tsx
import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import {
  Container, Typography, Box, Stack, Chip, Alert, Skeleton, Grid, Button, Divider
} from '@mui/material'
import { fetchAnimal, endAdoption } from '../services/api'   // ← add endAdoption
import { useAccess } from '../context/AccessContext'
import PostsSection from '../components/PostsSection'
import BlurBox from '../components/BlurBox'
import AdoptionDialog from '../components/AdoptionDialog'
import { useAuth } from '../context/AuthContext'

type Media = { url: string; type?: 'image'|'video' }
type LocalAnimal = {
  id: string
  jmeno: string
  druh?: 'pes'|'kočka'|'jiné'
  vek?: string
  popis?: string
  main?: string
  galerie?: Media[]
  active?: boolean
}

function asUrl(x: string | Media | undefined | null): string | null {
  if (!x) return null
  if (typeof x === 'string') return x
  return x.url || null
}

export default function AnimalDetail() {
  const { id } = useParams()
  const { hasAccess, grantAccess } = useAccess()
  const { token, role } = useAuth()
  const isStaff = role === 'ADMIN' || role === 'MODERATOR'

  const [animal, setAnimal] = useState<LocalAnimal | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [adoptOpen, setAdoptOpen] = useState(false)

  // Local "lock" flag to force re-blur after cancel (independent of AccessContext)
  const [forceLocked, setForceLocked] = useState(false)

  // Derived unlocked status: admin/mod always unlocked; otherwise depend on access AND not forceLocked
  const isUnlocked = useMemo(() => {
    if (role === 'ADMIN' || role === 'MODERATOR') return true
    return !!(id && hasAccess(id)) && !forceLocked
  }, [role, id, hasAccess, forceLocked])

  const loadAnimal = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setErr(null)
    try {
      const a = await fetchAnimal(id)
      setAnimal(a as any)
    } catch (e: any) {
      setErr(e?.message || 'Chyba načítání detailu')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    let alive = true
    if (!id) return
    setLoading(true); setErr(null)
    fetchAnimal(id)
      .then(a => { if (alive) setAnimal(a as any) })
      .catch(e => alive && setErr(e?.message || 'Chyba načítání detailu'))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [id])

  // Cancel adoption: re-lock immediately (desktop + mobile safe)
  const onCancelAdoption = useCallback(async () => {
    if (!animal) return
    try {
      // 1) Call backend to cancel
      // NOTE: replace with your real API if it differs
      // e.g., await api.cancelAdoption(animal.id)
      // If you already have such a function, import and call it here:
      // await api.cancelAdoption(animal.id)

      // 2) Remove any local persisted "access" flags
      try {
        localStorage.removeItem(`adopt:${animal.id}`)
        sessionStorage.removeItem(`adopt:${animal.id}`)
      } catch {}

      // 3) Stop and unload any playing videos to drop decoded buffers (iOS/Android)
      document.querySelectorAll('video').forEach((v) => {
        try {
          v.pause()
          v.removeAttribute('src')
          v.load()
        } catch {}
      })

      // 4) Force lock locally -> flips isUnlocked to false
      setForceLocked(true)

      // 5) Refetch data (ensures UI reflects server state)
      await loadAnimal()
    } catch (e) {
      // Optional: show error toast
      console.error('Cancel adoption failed', e)
    }
  }, [animal, loadAnimal])

  if (loading) {
    return (
      <Container sx={{ py: 4 }}>
        <Skeleton variant="text" width={280} height={40} />
        <Skeleton variant="rectangular" height={320} sx={{ mt: 2 }} />
      </Container>
    )
  }
  if (err) {
    return (
      <Container sx={{ py: 4 }}>
        <Alert severity="error">{err}</Alert>
      </Container>
    )
  }
  if (!animal || !id) return null

  const kind = animal.druh === 'pes' ? 'Pes' : animal.druh === 'kočka' ? 'Kočka' : 'Jiné'
  const age = animal.vek || 'neuvedeno'

  // Build a unique list of URLs from `main` + `galerie`
  const urls = Array.from(new Set([
    asUrl(animal.main) || undefined,
    ...((animal.galerie || []).map(g => asUrl(g) || undefined))
  ].filter(Boolean))) as string[]

  const mainUrl = urls[0] || '/no-image.jpg'
  const extraUrls = urls.slice(1)

  // Small helper to add a cache-busting param tied to lock state (prevents stale visible frames on phones)
  const lockTag = isUnlocked ? 'u1' : 'l1'
  const withBust = (u: string) => `${u}${u.includes('?') ? '&' : '?'}v=${lockTag}`

  return (
    <Container sx={{ py: 4 }}>
      {/* Header */}
      <Stack spacing={1.5}>
        <Typography variant="h4" sx={{ fontWeight: 900 }}>{animal.jmeno}</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip label={kind} />
          <Chip label={age} />
          {/* Show "Cancel adoption" only when unlocked by user */}
          {(!!token && !isStaff && isUnlocked) && (
  <Button
    variant="outlined"
    color="error"
    size="small"
    onClick={onCancelAdoption}
    sx={{ ml: 1 }}
  >
    Zrušit adopci
  </Button>
)}
        </Stack>
      </Stack>

      {/* Main photo & description (always visible) */}
      <Box sx={{ mt: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Box
              component="a"
              href={mainUrl}
              target="_blank"
              rel="noreferrer"
              sx={{ display: 'block', borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}
            >
              <img
                src={withBust(mainUrl)}
                alt="main"
                style={{ width: '100%', height: 320, objectFit: 'cover' }}
              />
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
              Popis
            </Typography>
            <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
              {animal.popis || 'Bez popisu.'}
            </Typography>

            <Divider sx={{ my: 2 }} />

            {!isUnlocked && (
              <Box id="adopce">
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                  Chci adoptovat
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                  Po adopci uvidíte další fotografie, videa a příspěvky.
                </Typography>
                <Button variant="contained" onClick={() => setAdoptOpen(true)}>
                  Pokračovat k adopci
                </Button>
              </Box>
            )}
          </Grid>
        </Grid>
      </Box>

      {/* Additional gallery (blurred until unlock) */}
      {extraUrls.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
            Další fotografie a videa
          </Typography>

          {/* key forces a clean re-mount when isUnlocked flips */}
          <BlurBox blurred={!isUnlocked} key={isUnlocked ? 'unlocked-extras' : 'locked-extras'}>
            <Grid container spacing={1.5}>
              {extraUrls.map((u, i) => {
                const src = withBust(u)
                return (
                  <Grid item xs={6} sm={4} md={3} key={`${i}-${lockTag}`}>
                    <Box
                      // prevent opening originals while locked
                      component={isUnlocked ? 'a' : 'div'}
                      {...(isUnlocked ? { href: u, target: '_blank', rel: 'noreferrer' } : {})}
                      sx={{
                        display: 'block',
                        width: '100%',
                        height: 160,
                        borderRadius: 2,
                        overflow: 'hidden',
                        border: '1px solid',
                        borderColor: 'divider'
                      }}
                      className={!isUnlocked ? 'lockedMedia' : undefined}
                    >
                      <img
                        src={src}
                        alt={`media-${i+1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </Box>
                  </Grid>
                )
              })}
            </Grid>
          </BlurBox>

          {!isUnlocked && (
            <Typography variant="caption" color="text.secondary">
              Zamčeno – odemkne se po adopci.
            </Typography>
          )}
        </Box>
      )}

      {/* Posts (blurred until unlock) */}
      <Box id="posts" sx={{ mt: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
          Příspěvky
        </Typography>
        <BlurBox blurred={!isUnlocked} key={isUnlocked ? 'unlocked-posts' : 'locked-posts'}>
          <PostsSection animalId={animal.id} />
        </BlurBox>
        {!isUnlocked && (
          <Typography variant="caption" color="text.secondary">
            Zamčeno – příspěvky se odemknou po adopci.
          </Typography>
        )}
      </Box>

      {/* Adoption dialog */}
      <AdoptionDialog
        open={adoptOpen}
        onClose={() => setAdoptOpen(false)}
        animalId={id}
        onGranted={() => {
          // adoption successful → clear force lock and let AccessContext rule
          setForceLocked(false)
          grantAccess(id!)
        }}
      />
    </Container>
  )
}