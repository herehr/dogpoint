import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import {
  Container, Typography, Box, Stack, Chip, Alert, Skeleton, Grid, Button, Divider
} from '@mui/material'

import { fetchAnimal } from '../services/api'
import { useAccess } from '../context/AccessContext'
import PostsSection from '../components/PostsSection'
import BlurBox from '../components/BlurBox'
import { useAuth } from '../context/AuthContext'
import SafeMarkdown from '../components/SafeMarkdown'
import AfterPaymentPasswordDialog from '../components/AfterPaymentPasswordDialog'

import {
  createCheckoutSession,
  confirmStripeSession,
  me,
  stashPendingEmail,
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
    if (
      now.getMonth() < bd.getMonth() ||
      (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())
    ) years -= 1
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

  const { hasAccess, grantAccess } = useAccess()
  const { role, user, refreshMe } = useAuth()
  const isStaff = role === 'ADMIN' || role === 'MODERATOR'

  const [animal, setAnimal] = useState<LocalAnimal | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [forceLocked, setForceLocked] = useState(false)
  const [showAfterPay, setShowAfterPay] = useState(false)
  const [dialogEmail, setDialogEmail] = useState('')

  // Stripe return flags
  const { paid, sid } = useMemo(() => {
    const p = new URLSearchParams(location.search)
    return { paid: p.get('paid'), sid: p.get('sid') || undefined }
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

  // On return from Stripe:
  // - Optimistic unlock
  // - Confirm session to obtain token/email (if available)
  // - Pre-fill and show password dialog for first-time users
  useEffect(() => {
    if (!id || paid !== '1') return
    (async () => {
      try {
        grantAccess(id)           // provisional unlock
        setForceLocked(false)

        let emailForDialog = user?.email || ''

        if (sid) {
          try {
            const conf = await confirmStripeSession(sid)
            // If backend returned a token, AuthContext should pick it up (me() below)
            if (conf?.token) {
              await me().catch(() => {})
              await refreshMe?.()
            }
            if (conf?.email) {
              emailForDialog = conf.email
              stashPendingEmail(conf.email)
            }
          } catch (e) {
            // ignore; dialog will still appear
            console.warn('[confirmStripeSession] failed', e)
          }
        }

        setDialogEmail(emailForDialog || user?.email || '')

        // open dialog for password setup / login
        setShowAfterPay(true)

        // clean URL
        const p = new URLSearchParams(location.search)
        p.delete('paid'); p.delete('sid')
        const clean = `${window.location.pathname}${p.toString() ? `?${p}` : ''}`
        window.history.replaceState({}, '', clean)
      } catch (e) {
        console.error('[return from stripe] flow error:', e)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, paid, sid])

  // Start Stripe
  const handleAdoptNow = useCallback(async () => {
    if (!id || !animal) {
      alert('Zkuste stránku znovu načíst (chybí ID zvířete).')
      return
    }
    try {
      const preferredEmail = user?.email || dialogEmail || ''
      if (preferredEmail) stashPendingEmail(preferredEmail)

      const session = await createCheckoutSession({
        animalId: id,
        amountCZK: 200,
        name: animal.jmeno || animal.name || 'Adopce',
        email: preferredEmail || undefined,
      })

      if (!session || !session.url) {
        alert('Server nevrátil odkaz na platbu. Zkuste to prosím znovu.')
        return
      }
      window.location.href = session.url
    } catch (e: any) {
      const msg = (e?.message || '').toString()
      alert(`Nepodařilo se spustit platbu.${msg ? `\n\nDůvod: ${msg}` : ''}`)
    }
  }, [id, animal, user?.email, dialogEmail])

  const onCancelAdoption = useCallback(async () => {
    if (!animal) return
    try {
      try {
        localStorage.removeItem(`adopt:${animal.id}`)
        sessionStorage.removeItem(`adopt:${animal.id}`)
      } catch {}
      document.querySelectorAll('video').forEach(v => {
        try { v.pause(); v.removeAttribute('src'); v.load() } catch {}
      })
      setForceLocked(true)
      setLoading(true)
      fetchAnimal(animal.id).then(a => setAnimal(a as any)).finally(() => setLoading(false))
    } catch (e) {
      console.error('Cancel adoption failed', e)
    }
  }, [animal])

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

            {/* Adoption / go straight to Stripe */}
            <Box id="adopce">
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                {isUnlocked ? 'Podpořit zvíře' : 'Chci adoptovat'}
              </Typography>

              {!isUnlocked ? (
                <>
                  <Typography color="text.secondary" sx={{ mb: 2 }}>
                    Po adopci uvidíte další fotografie, videa a příspěvky.
                  </Typography>
                  <Button variant="contained" onClick={handleAdoptNow}>
                    Pokračovat k platbě
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
        defaultEmail={dialogEmail}
        onLoggedIn={() => {
          if (id) grantAccess(id);
          navigate('/user'); // final step -> go to dashboard
        }}
      />
    </Container>
  )
}