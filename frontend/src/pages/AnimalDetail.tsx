// frontend/src/pages/AnimalDetail.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Grid,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import NotificationsIcon from '@mui/icons-material/Notifications'

import { fetchAnimal } from '../services/api'
import { useAccess } from '../context/AccessContext'
import PostsSection from '../components/PostsSection'
import BlurBox from '../components/BlurBox'
import { useAuth } from '../context/AuthContext'
import SafeHTML from '../components/SafeHTML'
import AfterPaymentPasswordDialog from '../components/AfterPaymentPasswordDialog'
import { confirmStripeSession, cancelAdoption } from '../services/api'
import { apiUrl } from '../services/api'

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
  gallery?: Media[]
  active?: boolean
  charakteristik?: string
  birthDate?: string | Date | null
  bornYear?: number | null
}

interface AnimalPost {
  id: string
  title: string
  body?: string | null
  publishedAt?: string | null
  createdAt: string
  active?: boolean
  media?: { id: string; url: string; typ?: string }[]
}

/* ─────────────────────────────────────────────── */
/* Helpers                                          */
/* ─────────────────────────────────────────────── */

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|m4v|mov)(\?|$)/i.test(url || '')
}

function isVideoMedia(m?: Partial<Media> | null): boolean {
  const t = String((m as any)?.typ || (m as any)?.type || '').toLowerCase()
  if (t.includes('video')) return true
  const u = String((m as any)?.url || '').toLowerCase()
  return isVideoUrl(u)
}

function guessVideoMime(url: string): string {
  const u = String(url || '').toLowerCase()
  if (u.includes('.webm')) return 'video/webm'
  return 'video/mp4'
}

function stripCache(url?: string | null): string {
  if (!url) return ''
  return url.split('?')[0]
}

function uniqByUrl(list: Media[]): Media[] {
  const seen = new Set<string>()
  const out: Media[] = []
  for (const m of list) {
    if (!m?.url) continue
    const clean = stripCache(m.url)
    if (seen.has(clean)) continue
    seen.add(clean)
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
    return `${Math.max(0, years)} r`
  }
  if (a.bornYear && a.bornYear > 1900) {
    const y = new Date().getFullYear() - a.bornYear
    return `${Math.max(0, y)} r`
  }
  if (a.vek) return a.vek
  return 'neuvedeno'
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

function withLockBust(url: string, unlocked: boolean): string {
  const tag = unlocked ? 'u1' : 'l1'
  return url.includes('?') ? `${url}&v=${tag}` : `${url}?v=${tag}`
}

function findPosterForUrl(gal: Media[], url: string): string | undefined {
  const clean = stripCache(url)
  const hit = (Array.isArray(gal) ? gal : []).find((m) => stripCache(m?.url) === clean)
  return hit?.posterUrl || hit?.poster || undefined
}

/* ─────────────────────────────────────────────── */
/* Media renderer                                   */
/* ─────────────────────────────────────────────── */

function MediaView(props: {
  url: string
  alt: string
  height: number
  poster?: string
  variant: 'detail' | 'thumb'
}) {
  const { url, alt, height, poster, variant } = props
  const video = isVideoUrl(url)

  if (video) {
    if (variant === 'detail') {
      return (
        <video
          muted
          autoPlay
          loop
          playsInline
          controls={false}
          preload="auto"
          style={{
            width: '100%',
            height,
            objectFit: 'cover',
            display: 'block',
            background: '#000',
          }}
        >
          <source src={url} type={guessVideoMime(url)} />
        </video>
      )
    }

    return (
      <Box sx={{ position: 'relative', width: '100%', height, bgcolor: '#000' }}>
        <video
          muted
          playsInline
          autoPlay
          loop
          preload="metadata"
          poster={poster}
          controls={false}
          style={{
            width: '100%',
            height,
            objectFit: 'cover',
            display: 'block',
          }}
        >
          <source src={url} type={guessVideoMime(url)} />
        </video>

        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            opacity: 0.9,
          }}
        >
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: 999,
              bgcolor: 'rgba(0,0,0,0.45)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              lineHeight: 1,
            }}
          >
            ▶
          </Box>
        </Box>
      </Box>
    )
  }

  return (
    <img
      src={url}
      alt={alt}
      style={{
        width: '100%',
        height,
        objectFit: 'cover',
        display: 'block',
      }}
      onError={(ev) => {
        ;(ev.currentTarget as HTMLImageElement).style.opacity = '0.35'
      }}
    />
  )
}

/* ─────────────────────────────────────────────── */
/* Component                                       */
/* ─────────────────────────────────────────────── */

export default function AnimalDetail() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()

  const { hasAccess, grantAccess, resetAccess } = useAccess()
  const { role, login } = useAuth()
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
  const lastPostCountRef = useRef<number>(0)

  const { paid, sid } = useMemo(() => {
    const p = new URLSearchParams(location.search)
    return { paid: p.get('paid'), sid: p.get('sid') || undefined }
  }, [location.search])

  const isUnlocked = useMemo(() => {
    if (isStaff) return true
    return !!(id && hasAccess(id)) && !forceLocked
  }, [isStaff, id, hasAccess, forceLocked])

    // ✅ BANK return handler: if user arrived from AdoptionStart (?bank=paid|email),
  // unlock immediately and clean the URL
  useEffect(() => {
    if (!id) return
    const p = new URLSearchParams(location.search)
    const bank = p.get('bank')
    if (bank === 'paid' || bank === 'email') {
      grantAccess(id)

      p.delete('bank')
      const clean = `${window.location.pathname}${p.toString() ? `?${p}` : ''}`
      window.history.replaceState({}, '', clean)
    }
  }, [id, location.search, grantAccess])

  // load animal
  useEffect(() => {
    let alive = true
    if (!id) return

    setLoading(true)
    setErr(null)

    fetchAnimal(id)
      .then((a) => {
        if (!alive) return
        const gal: Media[] = ((a as any)?.galerie || (a as any)?.gallery || []) as Media[]
        setAnimal({ ...(a as any), galerie: gal })
      })
      .catch((e) => {
        if (!alive) return
        setErr(e?.message || 'Chyba načítání detailu')
      })
      .finally(() => alive && setLoading(false))

    return () => {
      alive = false
    }
  }, [id])

  // ✅ FIX: use apiUrl() instead of manual API_BASE
  const loadPosts = useCallback(async (animalId: string) => {
    const res = await fetch(apiUrl(`/api/posts/public?animalId=${encodeURIComponent(animalId)}`))
    if (!res.ok) throw new Error(`Posts fetch failed: ${res.status}`)
    const data: AnimalPost[] = await res.json()
    return data || []
  }, [])

  // initial posts load
  useEffect(() => {
    if (!id) return
    let canceled = false
    ;(async () => {
      try {
        const data = await loadPosts(id)
        if (canceled) return
        setPosts(data)
        lastPostCountRef.current = data.length
      } catch (e) {
        if (!canceled) console.warn('[AnimalDetail] posts load failed', e)
      }
    })()
    return () => {
      canceled = true
    }
  }, [id, loadPosts])

  // polling only when unlocked (or staff)
  useEffect(() => {
    if (!id) return
    if (!isUnlocked) return

    const interval = setInterval(async () => {
      try {
        const data = await loadPosts(id)
        const newCount = data.length
        const prevCount = lastPostCountRef.current

        if (prevCount === 0) {
          setPosts(data)
          lastPostCountRef.current = newCount
          return
        }

        if (newCount > prevCount) {
          setHasNewPosts(true)
          setPosts(data)
          lastPostCountRef.current = newCount

          const newest = data[0] || data[data.length - 1]
          triggerBrowserNotification('Nový příspěvek u vašeho adoptovaného zvířete', {
            body: newest?.title || 'Podívejte se na nový příspěvek.',
          })
        }
      } catch (e) {
        console.warn('[AnimalDetail] polling failed', e)
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [id, isUnlocked, loadPosts])

  const prefillEmail = useMemo(() => {
    try {
      const stash = localStorage.getItem('dp:pendingUser')
      if (stash) {
        const parsed = JSON.parse(stash)
        if (parsed?.email) return String(parsed.email)
      }
      const fallback = localStorage.getItem('dp:pendingEmail')
      if (fallback) return String(fallback)
    } catch {}
    return ''
  }, [])

  // after payment return handler (keep your finalized logic)
  useEffect(() => {
    if (!id || paid !== '1') return

    ;(async () => {
      try {
        let tokenStr = ''
        let confirmedEmail = ''

        if (sid) {
          try {
            const conf = await confirmStripeSession(sid)
            if (conf?.token) tokenStr = conf.token
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

        if (tokenStr) {
          login(tokenStr, 'USER')
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

  const rawGallery: Media[] = Array.isArray((animal as any).galerie)
    ? ((animal as any).galerie as Media[])
    : Array.isArray((animal as any).gallery)
      ? ((animal as any).gallery as Media[])
      : []

  const merged: Media[] = uniqByUrl([
    ...(animal.main ? ([{ url: animal.main } as Media] as Media[]) : []),
    ...rawGallery,
  ])

  const firstVideo = merged.find((m) => m?.url && isVideoMedia(m))
  const mainUrl = animal.main || firstVideo?.url || merged[0]?.url || '/no-image.jpg'
  const mainPoster = findPosterForUrl(merged, mainUrl)

  const extras = merged.filter((m) => stripCache(m.url) !== stripCache(mainUrl))

  const mainSrc = withLockBust(mainUrl, isUnlocked)

  return (
    <Container sx={{ py: 4 }}>
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
            sx={{ cursor: 'pointer' }}
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
              <MediaView url={mainSrc} alt={title} height={320} poster={mainPoster} variant="detail" />
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

      {extras.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
            Další fotografie a videa
          </Typography>

          <BlurBox blurred={!isUnlocked} key={isUnlocked ? 'unlocked-extras' : 'locked-extras'}>
            <Grid container spacing={1.5}>
              {extras.map((m, i) => {
                const src = withLockBust(m.url, isUnlocked)
                const poster = findPosterForUrl(merged, m.url)
                return (
                  <Grid item xs={6} sm={4} md={3} key={`${m.url}-${i}`}>
                    <Box
                      sx={{
                        width: '100%',
                        height: 160,
                        borderRadius: 2,
                        overflow: 'hidden',
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: '#000',
                      }}
                      className={!isUnlocked ? 'lockedMedia' : undefined}
                    >
                      <MediaView url={src} alt={`media-${i + 1}`} height={160} poster={poster} variant="thumb" />
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
        defaultEmail={afterPayEmail || prefillEmail}
        onLoggedIn={() => {
          if (id) grantAccess(id)
          navigate('/user', { replace: true })
        }}
      />
    </Container>
  )
}