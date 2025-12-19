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
  Dialog,
  IconButton,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import CloseIcon from '@mui/icons-material/Close'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline'
import NotificationsIcon from '@mui/icons-material/Notifications'

import { fetchAnimal } from '../api'
import { useAccess } from '../context/AccessContext'
import PostsSection from '../components/PostsSection'
import BlurBox from '../components/BlurBox'
import { useAuth } from '../context/AuthContext'
import SafeHTML from '../components/SafeHTML'
import AfterPaymentPasswordDialog from '../components/AfterPaymentPasswordDialog'
import { confirmStripeSession, cancelAdoption } from '../services/api'

type Media = { url: string; type?: 'image' | 'video' }
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

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

function asUrl(x: string | Media | undefined | null): string | null {
  if (!x) return null
  if (typeof x === 'string') return x
  return x.url || null
}

// --- Basic media type guess (works even if backend does not send `type`) ---
function guessMediaType(url: string): 'image' | 'video' {
  const u = (url || '').split('?')[0].toLowerCase()
  if (/\.(mp4|webm|mov|m4v|ogg)$/i.test(u)) return 'video'
  return 'image'
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

type LightboxItem = { url: string; type: 'image' | 'video' }

export default function AnimalDetail() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()

  const theme = useTheme()
  const isSmDown = useMediaQuery(theme.breakpoints.down('sm'))

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

  // --- Lightbox state ---
  const [lbOpen, setLbOpen] = useState(false)
  const [lbIndex, setLbIndex] = useState(0)

  const { paid, sid } = useMemo(() => {
    const p = new URLSearchParams(location.search)
    return {
      paid: p.get('paid'),
      sid: p.get('sid') || undefined,
    }
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
        if (alive) setAnimal(a as any)
      })
      .catch((e) => alive && setErr(e?.message || 'Chyba načítání detailu'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [id])

  const loadPosts = useCallback(async (animalId: string) => {
    const url = `${API_BASE}/api/posts/public?animalId=${encodeURIComponent(animalId)}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Posts fetch failed: ${res.status}`)
    const data: AnimalPost[] = await res.json()
    return data
  }, [])

  useEffect(() => {
    if (!id) return
    let canceled = false
    const run = async () => {
      try {
        const data = await loadPosts(id)
        if (canceled) return
        setPosts(data)
        setLastPostCount(data.length)
      } catch (e) {
        if (!canceled) console.warn('[AnimalDetail] posts load failed', e)
      }
    }
    run()
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
    const confirmed = window.confirm(
      'Opravdu chcete zrušit adopci tohoto zvířete? Tím ukončíte pravidelnou podporu.'
    )
    if (!confirmed) return

    try {
      await cancelAdoption(animal.id)
      resetAccess(animal.id)
      setForceLocked(true)

      try {
        localStorage.removeItem(`adopt:${animal.id}`)
        sessionStorage.removeItem(`adopt:${animal.id}`)
      } catch {}

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
      alert('Nepodařilo se zrušit adopci. Zkuste to prosím znovu nebo nás kontaktujte.')
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

  const urls = Array.from(
    new Set(
      [
        asUrl(animal.main) || undefined,
        ...((animal.galerie || []).map((g) => asUrl(g) || undefined)),
      ].filter(Boolean)
    )
  ) as string[]

  const mainUrl = urls[0] || '/no-image.jpg'
  const extraUrls = urls.slice(1)

  const lockTag = isUnlocked ? 'u1' : 'l1'
  const withBust = (u: string) => `${u}${u.includes('?') ? '&' : '?'}v=${lockTag}`

  // Build lightbox list (main first, then extras), detect type
  const lightboxItems: LightboxItem[] = useMemo(() => {
    const list = [mainUrl, ...extraUrls].filter(Boolean)
    return list.map((u) => ({ url: u, type: guessMediaType(u) }))
  }, [mainUrl, extraUrls])

  const openLightboxAt = useCallback((index: number) => {
    setLbIndex(Math.max(0, Math.min(index, lightboxItems.length - 1)))
    setLbOpen(true)
  }, [lightboxItems.length])

  const closeLightbox = useCallback(() => {
    setLbOpen(false)
  }, [])

  const lbPrev = useCallback(() => {
    setLbIndex((i) => (i <= 0 ? 0 : i - 1))
  }, [])

  const lbNext = useCallback(() => {
    setLbIndex((i) => (i >= lightboxItems.length - 1 ? i : i + 1))
  }, [lightboxItems.length])

  const lbItem = lightboxItems[lbIndex]

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

      {/* Main photo & description */}
      <Box sx={{ mt: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            {/* ✅ Main media preview (click → lightbox) */}
            <Box
              role="button"
              tabIndex={0}
              onClick={() => openLightboxAt(0)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') openLightboxAt(0)
              }}
              sx={{
                cursor: 'zoom-in',
                borderRadius: 2.5,
                overflow: 'hidden',
                border: '1px solid',
                borderColor: 'divider',
                height: { xs: 280, sm: 360, md: 420 }, // bigger on desktop
                position: 'relative',
                backgroundColor: 'rgba(0,0,0,0.04)',
              }}
            >
              {guessMediaType(mainUrl) === 'video' ? (
                <>
                  <video
                    src={withBust(mainUrl)}
                    muted
                    playsInline
                    preload="metadata"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain', // keep portrait aspect
                      display: 'block',
                      background: 'black',
                    }}
                  />
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      pointerEvents: 'none',
                    }}
                  >
                    <PlayCircleOutlineIcon sx={{ fontSize: 72, opacity: 0.85, color: 'white' }} />
                  </Box>
                </>
              ) : (
                <img
                  src={withBust(mainUrl)}
                  alt="main"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
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
                      <Button
                        key={v}
                        variant={amount === v ? 'contained' : 'outlined'}
                        onClick={() => setAmount(v)}
                      >
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

      {/* Additional gallery */}
      {extraUrls.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
            Další fotografie a videa
          </Typography>

          <BlurBox blurred={!isUnlocked} key={isUnlocked ? 'unlocked-extras' : 'locked-extras'}>
            <Grid container spacing={1.5}>
              {extraUrls.map((u, i) => {
                const src = withBust(u)
                const idx = i + 1 // because main is 0
                const t = guessMediaType(u)

                return (
                  <Grid item xs={6} sm={4} md={3} key={`${i}-${lockTag}`}>
                    <Box
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (!isUnlocked) return
                        openLightboxAt(idx)
                      }}
                      onKeyDown={(e) => {
                        if (!isUnlocked) return
                        if (e.key === 'Enter' || e.key === ' ') openLightboxAt(idx)
                      }}
                      sx={{
                        position: 'relative',
                        display: 'block',
                        width: '100%',
                        height: 160,
                        borderRadius: 2,
                        overflow: 'hidden',
                        border: '1px solid',
                        borderColor: 'divider',
                        cursor: isUnlocked ? 'zoom-in' : 'default',
                      }}
                      className={!isUnlocked ? 'lockedMedia' : undefined}
                    >
                      {t === 'video' ? (
                        <>
                          <video
                            src={src}
                            muted
                            playsInline
                            preload="metadata"
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'contain', // keep portrait aspect in thumb too
                              display: 'block',
                              background: 'black',
                            }}
                          />
                          <Box
                            sx={{
                              position: 'absolute',
                              inset: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              pointerEvents: 'none',
                            }}
                          >
                            <PlayCircleOutlineIcon sx={{ fontSize: 44, opacity: 0.9, color: 'white' }} />
                          </Box>
                        </>
                      ) : (
                        <img
                          src={src}
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

      {/* After-payment dialog */}
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

      {/* ✅ Lightbox dialog */}
      <Dialog
        open={lbOpen}
        onClose={closeLightbox}
        fullWidth
        maxWidth="lg"
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: 'hidden',
            bgcolor: 'black',
          },
        }}
      >
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            height: isSmDown ? '70vh' : '80vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'black',
          }}
        >
          {/* close */}
          <IconButton
            onClick={closeLightbox}
            sx={{ position: 'absolute', top: 8, right: 8, color: 'white', zIndex: 2 }}
          >
            <CloseIcon />
          </IconButton>

          {/* prev */}
          <IconButton
            onClick={lbPrev}
            disabled={lbIndex <= 0}
            sx={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'white', zIndex: 2 }}
          >
            <ChevronLeftIcon />
          </IconButton>

          {/* next */}
          <IconButton
            onClick={lbNext}
            disabled={lbIndex >= lightboxItems.length - 1}
            sx={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'white', zIndex: 2 }}
          >
            <ChevronRightIcon />
          </IconButton>

          {/* media */}
          {lbItem?.type === 'video' ? (
            <video
              src={withBust(lbItem.url)}
              controls
              playsInline
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain', // keep portrait exactly
                background: 'black',
              }}
            />
          ) : (
            <img
              src={withBust(lbItem?.url || '')}
              alt="preview"
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          )}

          {/* counter */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 10,
              left: '50%',
              transform: 'translateX(-50%)',
              color: 'white',
              fontSize: 13,
              opacity: 0.8,
            }}
          >
            {lbIndex + 1} / {lightboxItems.length}
          </Box>
        </Box>
      </Dialog>
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
      if (permission === 'granted') {
        new Notification(title, options)
      }
    })
  }
}