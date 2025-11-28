// frontend/src/pages/AnimalDetail.tsx
import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import {
  Container, Typography, Box, Stack, Chip, Alert, Skeleton, Grid, Button, Divider, TextField
} from '@mui/material'

import { fetchAnimal } from '../api'
import { useAccess } from '../context/AccessContext'
import PostsSection from '../components/PostsSection'
import BlurBox from '../components/BlurBox'
import { useAuth } from '../context/AuthContext'
import SafeMarkdown from '../components/SafeMarkdown'
import AfterPaymentPasswordDialog from '../components/AfterPaymentPasswordDialog'
import {
  confirmStripeSession,
  cancelAdoption,
} from '../services/api'

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

// STEP 1 – NEW: type for posts used by notifications / polling
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

function asUrl(x: string | Media | undefined | null): string | null {
  if (!x) return null
  if (typeof x === 'string') return x
  return x.url || null
}

function formatAge(a: LocalAnimal): string {
  const bd = a.birthDate ? new Date(a.birthDate) : null
  if (bd && !Number.isNaN(bd.getTime())) {
    const now = new Date()
    let years = now.getFullYear() - bd.getFullYear()
    if (now.getMonth() < bd.getMonth() || (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())) {
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

  // amount picker
  const [amount, setAmount] = useState<number>(200)

  // STEP 1 – NEW: state for posts + notification tracking
  const [posts, setPosts] = useState<AnimalPost[]>([])
  const [hasNewPosts, setHasNewPosts] = useState(false)
  const [lastPostId, setLastPostId] = useState<string | null>(null)
  const [lastCheckAt, setLastCheckAt] = useState<string | null>(null)

  // Read Stripe return flags ONCE
  const { paid, sid } = useMemo(() => {
    const p = new URLSearchParams(location.search)
    return {
      paid: p.get('paid'),
      sid : p.get('sid') || undefined
    }
  }, [location.search])

  const isUnlocked = useMemo(() => {
    if (isStaff) return true
    return !!(id && hasAccess(id)) && !forceLocked
  }, [isStaff, id, hasAccess, forceLocked])

  // initial load
  useEffect(() => {
    let alive = true
    if (!id) return
    setLoading(true)
    setErr(null)
    fetchAnimal(id)
      .then(a => { if (alive) setAnimal(a as any) })
      .catch(e => alive && setErr(e?.message || 'Chyba načítání detailu'))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [id])

  // Prefill email for after-payment (prefer logged-in, else stashed)
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

  // On return from Stripe: confirm session → if token, go to /user, otherwise stay blurred
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

        // Clean URL so paid/sid do not re-trigger on refresh
        const p = new URLSearchParams(location.search)
        p.delete('paid')
        p.delete('sid')
        const clean = `${window.location.pathname}${p.toString() ? `?${p}` : ''}`
        window.history.replaceState({}, '', clean)

        // If backend returned a token → auto-login via AuthContext and go straight to /user
        if (token) {
          // Use AuthContext so route guards see the logged-in state immediately
          login(token, 'USER')

          navigate('/user', { replace: true })
          return
        }

        // IMPORTANT:
        // - Do NOT grantAccess(id)
        // - Do NOT setForceLocked(false)
        // → animal remains blurred until user logs in manually

        // Optional: show after-payment dialog so user can finish account setup
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

  // amount quick presets
  const pickAmount = (v: number) => setAmount(v)

  // NEW: go to pre-checkout page instead of Stripe directly
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
      // 1) Tell backend to cancel the subscription
      await cancelAdoption(animal.id)

      // 2) Clear local unlock for this animal → detail will be locked again
      resetAccess(animal.id)
      setForceLocked(true)

      // 3) Clean up any local flags / media (optional)
      try {
        localStorage.removeItem(`adopt:${animal.id}`)
        sessionStorage.removeItem(`adopt:${animal.id}`)
      } catch {}
      document.querySelectorAll('video').forEach(v => {
        try { v.pause(); v.removeAttribute('src'); v.load() } catch {}
      })

      alert('Adopce byla zrušena. Děkujeme za dosavadní podporu.')
    } catch (e: any) {
      console.error('Cancel adoption failed', e)
      alert(
        'Nepodařilo se zrušit adopci. Zkuste to prosím znovu nebo nás kontaktujte.'
      )
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
    new Set([
      asUrl(animal.main) || undefined,
      ...((animal.galerie || []).map(g => asUrl(g) || undefined)),
    ].filter(Boolean))
  ) as string[]

  const mainUrl = urls[0] || '/no-image.jpg'
  const extraUrls = urls.slice(1)

  const lockTag = isUnlocked ? 'u1' : 'l1'
  const withBust = (u: string) => `${u}${u.includes('?') ? '&' : '?'}v=${lockTag}`

  return (
    <Container sx={{ py: 4 }}>
      {/* Header */}
      <Stack spacing={1.25}>
        <Typography variant="h4" sx={{ fontWeight: 900 }}>
          {title}
        </Typography>

        {animal.charakteristik && (
          <div
            style={{
              fontWeight: 700,
              padding: '6px 10px',
              borderRadius: 12,
              display: 'inline-block',
              background: '#00bcd4',
              color: 'white',
              boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              maxWidth: '100%',
              wordBreak: 'break-word',
            }}
          >
            <SafeMarkdown>{animal.charakteristik}</SafeMarkdown>
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
            <Box
              component="a"
              href={mainUrl}
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
            <div style={{ lineHeight: 1.6 }}>
              <SafeMarkdown>{desc}</SafeMarkdown>
            </div>

            <Divider sx={{ my: 2 }} />

            {/* Adoption / amount picker / go to pre-checkout */}
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
                    {[200, 500, 1000].map(v => (
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
                      onChange={e => setAmount(Math.max(0, parseInt(e.target.value || '0', 10)))}
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
                return (
                  <Grid item xs={6} sm={4} md={3} key={`${i}-${lockTag}`}>
                    <Box
                      component={isUnlocked ? 'a' : 'div'}
                      {...(isUnlocked ? { href: u, target: '_blank', rel: 'noreferrer' } : {})}
                      sx={{
                        display: 'block',
                        width: '100%',
                        height: 160,
                        borderRadius: 2,
                        overflow: 'hidden',
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                      className={!isUnlocked ? 'lockedMedia' : undefined}
                    >
                      <img
                        src={src}
                        alt={`media-${i + 1}`}
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

      {/* After-payment dialog (email + password) */}
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