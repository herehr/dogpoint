// frontend/src/pages/AnimalDetail.tsx
import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import {
  Container,
  Typography,
  Box,
  Stack,
  Chip,
  Alert,
  Skeleton,
  Grid,
  Button,
  Divider,
  TextField,
} from '@mui/material'
import NotificationsIcon from '@mui/icons-material/Notifications'

import { fetchAnimal } from '../api'
import { useAccess } from '../context/AccessContext'
import PostsSection from '../components/PostsSection'
import BlurBox from '../components/BlurBox'
import { useAuth } from '../context/AuthContext'
import SafeHTML from '../components/SafeHTML'
import AfterPaymentPasswordDialog from '../components/AfterPaymentPasswordDialog'
import { confirmStripeSession, cancelAdoption } from '../services/api'

type Media = {
  url: string
  type?: 'image' | 'video' | string
  typ?: 'image' | 'video' | string
  poster?: string | null
  posterUrl?: string | null
}

type LocalAnimal = {
  id: string
  jmeno?: string
  name?: string
  vek?: string
  popis?: string
  description?: string
  main?: string
  galerie?: Media[]
  active?: boolean
  charakteristik?: string
  birthDate?: string | Date | null
  bornYear?: number | null
}

interface AnimalPost {
  id: string
  title: string
  body?: string | null
  publishedAt: string
  createdAt: string
  active: boolean
  media: {
    id: string
    url: string
    typ: string
  }[]
}

// IMPORTANT: VITE_API_BASE_URL should be like "https://...ondigitalocean.app"
const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

/* ─────────────────────────────────────────────── */
/* Media helpers (CRITICAL for Chrome)              */
/* ─────────────────────────────────────────────── */

function isVideoMedia(m?: Media | null): boolean {
  if (!m?.url) return false
  const t = String(m.typ || m.type || '').toLowerCase()
  if (t.includes('video')) return true
  return /\.(mp4|webm|m4v|mov)(\?|$)/i.test(m.url)
}

function guessVideoMime(url: string): string {
  const u = (url || '').toLowerCase()
  if (u.endsWith('.webm')) return 'video/webm'
  return 'video/mp4'
}

function uniqByUrl(list: Media[]): Media[] {
  const seen = new Set<string>()
  const out: Media[] = []
  for (const m of list) {
    if (!m?.url) continue
    if (seen.has(m.url)) continue
    seen.add(m.url)
    out.push(m)
  }
  return out
}

function formatAge(a: LocalAnimal): string {
  const bd = a.birthDate ? new Date(a.birthDate) : null
  if (bd && !Number.isNaN(bd.getTime())) {
    const now = new Date()
    let years = now.getFullYear() - bd.getFullYear()
    if (
      now.getMonth() < bd.getMonth() ||
      (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())
    ) {
      years -= 1
    }
    return `${years} r`
  }
  if (a.bornYear && a.bornYear > 1900) {
    const y = new Date().getFullYear() - a.bornYear
    return `${y} r`
  }
  if (a.vek) return a.vek
  return 'neuvedeno'
}

export default function AnimalDetail() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()

  const { hasAccess, grantAccess, resetAccess } = useAccess()
  const { role, user, login } = useAuth()
  const isStaff = role === 'ADMIN' || role === 'MODERATOR'

  const [animal, setAnimal] = useState<LocalAnimal | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [forceLocked, setForceLocked] = useState(false)
  const [showAfterPay, setShowAfterPay] = useState(false)
  const [afterPayEmail, setAfterPayEmail] = useState('')

  const [amount, setAmount] = useState<number>(200)

  const [posts, setPosts] = useState<AnimalPost[]>([])
  const [hasNewPosts, setHasNewPosts] = useState(false)
  const [lastPostCount, setLastPostCount] = useState<number>(0)

  const { paid, sid } = useMemo(() => {
    const p = new URLSearchParams(location.search)
    return { paid: p.get('paid'), sid: p.get('sid') || undefined }
  }, [location.search])

  const isUnlocked = useMemo(() => {
    if (isStaff) return true
    return !!(id && hasAccess(id)) && !forceLocked
  }, [isStaff, id, hasAccess, forceLocked])

  useEffect(() => {
    let alive = true
    if (!id) return
    setLoading(true)
    setErr(null)

    fetchAnimal(id)
      .then((a) => {
        if (!alive) return
        // normalize galerie key
        const gal: Media[] = (a as any)?.galerie || (a as any)?.gallery || []
        setAnimal({ ...(a as any), galerie: gal })
      })
      .catch((e) => alive && setErr(e?.message || 'Chyba načítání detailu'))
      .finally(() => alive && setLoading(false))

    return () => {
      alive = false
    }
  }, [id])

  const loadPosts = useCallback(async (animalId: string) => {
    // IMPORTANT: do not double "/api" when API_BASE already ends with it
    const base = API_BASE ? API_BASE.replace(/\/+$/, '') : ''
    const url = `${base}/api/posts/public?animalId=${encodeURIComponent(animalId)}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Posts fetch failed: ${res.status}`)
    const data: AnimalPost[] = await res.json()
    return data
  }, [])

  useEffect(() => {
    if (!id) return
    let canceled = false
    ;(async () => {
      try {
        const data = await loadPosts(id)
        if (canceled) return
        setPosts(data)
        setLastPostCount(data.length)
      } catch (e) {
        if (!canceled) console.warn('[AnimalDetail] Nepodařilo se načíst příspěvky pro notifikace', e)
      }
    })()
    return () => {
      canceled = true
    }
  }, [id, loadPosts])

  useEffect(() => {
    if (!id) return
    const interval = setInterval(async () => {
      try {
        const data = await loadPosts(id)
        const newCount = data.length

        if (lastPostCount === 0) {
          setPosts(data)
          setLastPostCount(newCount)
          return
        }

        if (newCount > lastPostCount) {
          setHasNewPosts(true)
          setPosts(data)
          setLastPostCount(newCount)
          const newest = data[0] || data[data.length - 1]
          triggerBrowserNotification('Nový příspěvek u vašeho adoptovaného zvířete', {
            body: newest?.title || 'Podívejte se na nový příspěvek.',
          })
        }
      } catch (e) {
        console.warn('[AnimalDetail] Polling příspěvků selhalo', e)
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [id, lastPostCount, loadPosts])

  const prefillEmail = useMemo(() => {
    try {
      if (user?.email) return user.email
      const stash = localStorage.getItem('dp:pendingUser')
      if (stash) {
        const parsed = JSON.parse(stash)
        if (parsed?.email) return String(parsed.email)
      }
      const fallback = localStorage.getItem('dp:pendingEmail')
      if (fallback) return String(fallback)
    } catch {}
    return ''
  }, [user?.email])

  useEffect(() => {
    if (!id || paid !== '1') return
    ;(async () => {
      try {
        let token = ''
        let confirmedEmail = ''

        if (sid) {
          try {
            const conf = await confirmStripeSession(sid)
            if (conf?.token) token = conf.token
            if (conf?.email) confirmedEmail = conf.email
          } catch (e) {
            console.warn('[confirmStripeSession]', e)
          }
        }

        // clean URL
        const p = new URLSearchParams(location.search)
        p.delete('paid')
        p.delete('sid')
        const clean = `${window.location.pathname}${p.toString() ? `?${p}` : ''}`
        window.history.replaceState({}, '', clean)

        if (token) {
          login(token, 'USER')
          navigate('/user', { replace: true })
          return
        }

        if (confirmedEmail) {
          setAfterPayEmail(confirmedEmail)
          setShowAfterPay(true)
        }
      } catch (e) {
        console.warn('[after payment handler failed]', e)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, paid, sid])

  const handleAdoptNow = useCallback(() => {
    if (!id || !animal) {
      alert('Zkuste stránku znovu načíst (chybí ID zvířete).')
      return
    }
    if (!amount || amount < 50) {
      alert('Minimální částka je 50 Kč.')
      return
    }
    const params = new URLSearchParams({ amount: String(amount) })
    navigate(`/adopce/${id}?${params.toString()}`)
  }, [id, animal, amount, navigate])

  const onCancelAdoption = useCallback(async () => {
    if (!animal) return
    const confirmed = window.confirm('Opravdu chcete zrušit adopci tohoto zvířete?')
    if (!confirmed) return

    try {
      await cancelAdoption(animal.id)
      resetAccess(animal.id)
      setForceLocked(true)

      try {
        localStorage.removeItem(`adopt:${animal.id}`)
        sessionStorage.removeItem(`adopt:${animal.id}`)
      } catch {}

      // stop all videos
      document.querySelectorAll('video').forEach((v) => {
        try {
          v.pause()
          v.removeAttribute('src')
          v.load()
        } catch {}
      })

      alert('Adopce byla zrušena. Děkujeme za dosavadní podporu.')
    } catch (e: any) {
      console.error('Cancel adoption failed', e)
      alert('Nepodařilo se zrušit adopci.')
    }
  }, [animal, resetAccess])

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

  const title = animal.jmeno || animal.name || '—'
  const age = formatAge(animal)
  const desc = animal.popis || animal.description || 'Bez popisu.'

  const rawGallery: Media[] = Array.isArray(animal.galerie) ? animal.galerie : []
  const merged: Media[] = uniqByUrl([
    ...(animal.main ? [{ url: animal.main } as Media] : []),
    ...rawGallery,
  ])

  const mainMedia: Media | undefined = merged[0]
  const extraMedia: Media[] = merged.slice(1)

  const lockTag = isUnlocked ? 'u1' : 'l1'
  const withBust = (u: string) => `${u}${u.includes('?') ? '&' : '?'}v=${lockTag}`

  return (
    <Container sx={{ py: 4 }}>
      {/* Header */}
      <Stack spacing={1.25}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h4" sx={{ fontWeight: 900, flexGrow: 1 }}>
            {title}
          </Typography>

          <Chip
            size="small"
            label={posts.length}
            variant="outlined"
            color={hasNewPosts ? 'primary' : 'default'}
            sx={{ mr: 0.5 }}
          />

          <NotificationsIcon
            className={hasNewPosts ? 'notification-icon blink' : 'notification-icon'}
            titleAccess={hasNewPosts ? 'Nový příspěvek' : 'Příspěvky'}
            onClick={() => {
              const el = document.getElementById('posts')
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
              setHasNewPosts(false)
            }}
          />
        </Stack>

        {animal.charakteristik && (
          <div
            style={{
              fontWeight: 700,
              padding: '6px 10px',
              borderRadius: 12,
              display: 'inline-block',
              background: '#e0f7fa',
              boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              maxWidth: '100%',
              wordBreak: 'break-word',
            }}
          >
            <SafeHTML>{animal.charakteristik}</SafeHTML>
          </div>
        )}

        <Stack direction="row" spacing={1} alignItems="center">
          <Chip label={age} />
          {!isStaff && isUnlocked && (
            <Button variant="outlined" color="error" size="small" onClick={onCancelAdoption}>
              Zrušit adopci
            </Button>
          )}
        </Stack>
      </Stack>

      {/* Main media + description */}
      <Box sx={{ mt: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Box
              sx={{
                display: 'block',
                borderRadius: 2,
                overflow: 'hidden',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              {mainMedia && isVideoMedia(mainMedia) ? (
                <video
                  controls
                  preload="metadata"
                  playsInline
                  poster={mainMedia.posterUrl || mainMedia.poster || undefined}
                  style={{ width: '100%', height: 320, objectFit: 'cover', display: 'block' }}
                >
                  <source src={withBust(mainMedia.url)} type={guessVideoMime(mainMedia.url)} />
                </video>
              ) : (
                <img
                  src={withBust(mainMedia?.url || '/no-image.jpg')}
                  alt="main"
                  style={{ width: '100%', height: 320, objectFit: 'cover', display: 'block' }}
                />
              )}
            </Box>
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
              Popis
            </Typography>
            <div style={{ lineHeight: 1.6 }}>
              <SafeHTML>{desc}</SafeHTML>
            </div>

            <Divider sx={{ my: 2 }} />

            <Box id="adopce">
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                {isUnlocked ? 'Podpořit zvíře' : 'Chci adoptovat'}
              </Typography>

              {!isUnlocked ? (
                <>
                  <Typography color="text.secondary" sx={{ mb: 2 }}>
                    Po adopci uvidíte další fotografie, videa a příspěvky.
                  </Typography>

                  <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                    {[200, 500, 1000].map((v) => (
                      <Button key={v} variant={amount === v ? 'contained' : 'outlined'} onClick={() => setAmount(v)}>
                        {v} Kč
                      </Button>
                    ))}
                  </Stack>

                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                    <TextField
                      type="number"
                      label="Částka (Kč)"
                      value={amount}
                      onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value || '0', 10)))}
                      inputProps={{ min: 50, step: 10 }}
                      sx={{ width: 160 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      Minimum 50 Kč
                    </Typography>
                  </Stack>

                  <Button variant="contained" onClick={handleAdoptNow}>
                    Pokračovat
                  </Button>
                </>
              ) : (
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  Adopce je aktivní. Děkujeme!
                </Typography>
              )}
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* Gallery */}
      {extraMedia.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
            Další fotografie a videa
          </Typography>

          <BlurBox blurred={!isUnlocked} key={isUnlocked ? 'unlocked-extras' : 'locked-extras'}>
            <Grid container spacing={1.5}>
              {extraMedia.map((m, i) => {
                const isVid = isVideoMedia(m)
                const poster = m.posterUrl || m.poster || undefined

                return (
                  <Grid item xs={6} sm={4} md={3} key={`${m.url}-${i}-${lockTag}`}>
                    <Box
                      sx={{
                        width: '100%',
                        height: 160,
                        borderRadius: 2,
                        overflow: 'hidden',
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                      className={!isUnlocked ? 'lockedMedia' : undefined}
                    >
                      {isVid ? (
                        <video
                          controls
                          preload="metadata"
                          playsInline
                          poster={poster}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        >
                          <source src={withBust(m.url)} type={guessVideoMime(m.url)} />
                        </video>
                      ) : (
                        <img
                          src={withBust(m.url)}
                          alt={`media-${i + 1}`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                      )}
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

      {/* Posts */}
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

      <AfterPaymentPasswordDialog
        open={showAfterPay}
        onClose={() => setShowAfterPay(false)}
        animalId={id}
        defaultEmail={afterPayEmail || prefillEmail}
        onLoggedIn={() => {
          if (id) grantAccess(id)
          navigate('/user', { replace: true })
        }}
      />
    </Container>
  )
}

function triggerBrowserNotification(title: string, options?: NotificationOptions) {
  if (typeof window === 'undefined') return
  if (!('Notification' in window)) return

  if (Notification.permission === 'granted') {
    new Notification(title, options)
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') new Notification(title, options)
    })
  }
}