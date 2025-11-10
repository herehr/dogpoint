// frontend/src/pages/AnimalDetail.tsx
import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import {
  Container, Typography, Box, Stack, Chip, Alert, Skeleton, Grid, Button, Divider
} from '@mui/material'

import { fetchAnimal } from '../api'
import { useAccess } from '../context/AccessContext'
import PostsSection from '../components/PostsSection'
import BlurBox from '../components/BlurBox'
import AdoptionDialog from '../components/AdoptionDialog'
import { useAuth } from '../context/AuthContext'
import SafeMarkdown from '../components/SafeMarkdown'
import PaymentButtons from '../components/payments/PaymentButtons'

// services for auth + post-payment register
import { me, registerAfterPayment } from '../services/api'
import { setAuthToken } from '../services/auth'

// Optional: if you have a ready-made dialog, we’ll trigger it;
// otherwise, you can replace with your own inline form later.
import AfterPaymentPasswordDialog from '../components/AfterPaymentPasswordDialog'

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

  const { hasAccess, grantAccess } = useAccess()
  const { token, role } = useAuth()
  const isStaff = role === 'ADMIN' || role === 'MODERATOR'

  const [animal, setAnimal] = useState<LocalAnimal | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [adoptOpen, setAdoptOpen] = useState(false)
  const [forceLocked, setForceLocked] = useState(false)

  // post-payment dialog state
  const [showAfterPay, setShowAfterPay] = useState(false)
  const [prefillEmail, setPrefillEmail] = useState<string>('')

  const isUnlocked = useMemo(() => {
    if (isStaff) return true
    return !!(id && hasAccess(id)) && !forceLocked
  }, [isStaff, id, hasAccess, forceLocked])

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

  // On Stripe return (?paid=1): open password dialog with prefilled email,
  // grant temporary access so the page unblurs immediately after successful login.
  useEffect(() => {
    if (!id) return
    const params = new URLSearchParams(location.search)
    const paid = params.get('paid')

    if (paid === '1') {
      // restore email we stashed before redirect
      let email = ''
      try {
        const stash = localStorage.getItem('dp:pendingUser')
        if (stash) {
          const parsed = JSON.parse(stash)
          if (parsed?.email) email = parsed.email
        }
        if (!email) {
          const fallbackEmail = localStorage.getItem('dp:pendingEmail')
          if (fallbackEmail) email = fallbackEmail
        }
      } catch {}

      if (email) setPrefillEmail(email)

      // show the password dialog for /register-after-payment
      setShowAfterPay(true)

      // Clean URL (remove ?paid=1) – purely cosmetic
      params.delete('paid')
      const clean = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`
      window.history.replaceState({}, '', clean)
    }
  }, [id, location.search])

  // called by dialog after password submit success
  const handleAfterPayComplete = useCallback(async (email: string, password: string) => {
    // 1) call backend to create/set password and link pledges → get JWT
    const res = await registerAfterPayment(email, password) // { ok, token, role }
    setAuthToken(res.token)

    // 2) ensure access to THIS animal right now (session-level unlock)
    if (id) grantAccess(id)
    setForceLocked(false)

    // 3) refresh "me" so the header shows “logged in”
    try { await me() } catch {}

    // 4) cleanup email stash
    try {
      localStorage.removeItem('dp:pendingUser')
      localStorage.removeItem('dp:pendingEmail')
    } catch {}

    setShowAfterPay(false)
  }, [grantAccess, id])

  const onCancelAdoption = useCallback(async () => {
    if (!animal) return
    try {
      try {
        localStorage.removeItem(`adopt:${animal.id}`)
        sessionStorage.removeItem(`adopt:${animal.id}`)
      } catch {}

      document.querySelectorAll('video').forEach(v => {
        try {
          v.pause()
          v.removeAttribute('src')
          v.load()
        } catch {}
      })

      setForceLocked(true)
      await loadAnimal()
    } catch (e) {
      // eslint-disable-next-line no-console
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

        {/* Charakteristik pill */}
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
          {!!token && !isStaff && isUnlocked && (
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

            {/* Adoption or payment section */}
            <Box id="adopce">
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                {isUnlocked ? 'Podpořit zvíře' : 'Chci adoptovat'}
              </Typography>

              {!isUnlocked ? (
                <>
                  <Typography color="text.secondary" sx={{ mb: 2 }}>
                    Po adopci uvidíte další fotografie, videa a příspěvky.
                  </Typography>
                  <Button variant="contained" onClick={() => setAdoptOpen(true)}>
                    Pokračovat k adopci
                  </Button>
                </>
              ) : (
                <Box sx={{ mt: 2 }}>
                  <Typography color="text.secondary" sx={{ mb: 2 }}>
                    Vyberte způsob platby:
                  </Typography>
                  <PaymentButtons
                    animalId={animal.id}
                    amountCZK={200}
                    email={undefined} // pokud znáte e-mail uživatele, můžete ho sem předat
                    name={animal.jmeno || animal.name}
                  />
                </Box>
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

      {/* Adoption dialog */}
      <AdoptionDialog
        open={adoptOpen}
        onClose={() => setAdoptOpen(false)}
        animalId={id}
        onGranted={() => {
          setForceLocked(false)
          grantAccess(id!)
        }}
      />

      {/* After-payment password dialog */}
      <AfterPaymentPasswordDialog
        open={showAfterPay}
        onClose={() => setShowAfterPay(false)}
        animalId={id}
        defaultEmail={prefillEmail}     // ← prefill form email here
        onSubmit={handleAfterPayComplete} // ← calls registerAfterPayment, saves token, grantAccess, me()
      />
    </Container>
  )
}