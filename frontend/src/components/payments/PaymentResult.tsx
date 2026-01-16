// frontend/src/components/payments/PaymentResult.tsx
import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Container, Paper, Typography, Alert, Button, Stack, CircularProgress } from '@mui/material'

// If you already have a central API helper, use it instead.
// This works with Vite env like VITE_API_BASE_URL=https://.../api  (or without /api).
const API_BASE =
  ((import.meta as any).env?.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') ||
  'http://localhost:3000'

function getApiUrl(path: string) {
  // if API_BASE already ends with /api, don't double it
  const baseHasApi = /\/api$/.test(API_BASE)
  if (path.startsWith('/api/')) return `${API_BASE}${path.replace('/api', baseHasApi ? '' : '')}`
  if (baseHasApi) return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`
  return `${API_BASE}/api${path.startsWith('/') ? path : `/${path}`}`
}

// Optional: if you already stash pending email in localStorage (stashPendingEmail),
// keep the same key. Adjust if your key differs.
function getPendingEmail(): string | null {
  try {
    return localStorage.getItem('pendingEmail') || sessionStorage.getItem('pendingEmail')
  } catch {
    return null
  }
}

export default function PaymentResult() {
  const { search } = useLocation()
  const navigate = useNavigate()
  const q = React.useMemo(() => new URLSearchParams(search), [search])

  // Common params
  const ok = q.get('ok') // "1" | "0"
  const provider = (q.get('provider') || '').toLowerCase() // "stripe" | "gpwebpay" | ...
  const animalId = q.get('animalId') // provided by backend success_url
  const sessionId = q.get('session_id') || q.get('sessionId') // Stripe
  const order = q.get('order') // GPwebpay variant

  const [state, setState] = React.useState<'success' | 'cancel' | 'unknown'>('unknown')
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)
  const [info, setInfo] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (ok === '1') setState('success')
    else if (ok === '0') setState('cancel')
    else setState('unknown')
  }, [ok])

  const nextUrl = React.useMemo(() => {
    if (animalId) return `/zvire/${animalId}`
    return '/moje-adopce'
  }, [animalId])

  // ✅ On success: verify/claim payment and log user in (if backend supports it)
  React.useEffect(() => {
    let cancelled = false

    async function run() {
      if (state !== 'success') return

      // Stripe flow: session_id is the reliable handle
      if (provider === 'stripe') {
        if (!sessionId) {
          setInfo('Platba proběhla, ale chybí session_id. Ověření přes webhook může chvíli trvat.')
          return
        }

        setBusy(true)
        setErr(null)

        try {
          const email = getPendingEmail()

          // Prefer a "claim" endpoint (you already mentioned /api/auth/claim-paid earlier).
          // Payload is intentionally tolerant: backend can use what it needs.
          const r = await fetch(getApiUrl('/auth/claim-paid'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider: 'STRIPE',
              sessionId,
              email: email || undefined,
            }),
          })

          const data = await r.json().catch(() => ({}))

          if (!r.ok) {
            const msg = data?.error || 'Nepodařilo se ověřit platbu. Zkuste to prosím za chvíli.'
            throw new Error(msg)
          }

          // If backend returns token, store it (common pattern)
          if (data?.token) {
            try {
              sessionStorage.setItem('token', data.token)
              sessionStorage.setItem('authToken', data.token)
              // if your app uses a specific key like "userToken", add it too:
              // sessionStorage.setItem('userToken', data.token)
            } catch {
              // ignore storage errors
            }
          }

          if (cancelled) return
          setInfo('Platba ověřena. Přesměrovávám…')
          navigate(nextUrl, { replace: true })
        } catch (e: any) {
          if (cancelled) return
          setErr((e?.message || '').toString() || 'Došlo k chybě při ověření platby.')
        } finally {
          if (!cancelled) setBusy(false)
        }

        return
      }

      // GPwebpay (optional): if you want, you can do order lookup similarly
      if (provider === 'gpwebpay' && order) {
        setInfo('Platba byla přijata. Stav bude ověřen podle objednávky.')
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [state, provider, sessionId, order, navigate, nextUrl])

  return (
    <Container maxWidth="sm" sx={{ py: 5 }}>
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
        {state === 'success' && (
          <Typography variant="h5" sx={{ fontWeight: 900, mb: 1 }}>
            ✅ Platba proběhla úspěšně
          </Typography>
        )}
        {state === 'cancel' && (
          <Typography variant="h5" sx={{ fontWeight: 900, mb: 1 }}>
            ⚠️ Platba byla zrušena
          </Typography>
        )}
        {state === 'unknown' && (
          <Typography variant="h5" sx={{ fontWeight: 900, mb: 1 }}>
            ℹ️ Stav platby bude ověřen
          </Typography>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Děkujeme za podporu Dogpointu.
        </Typography>

        {order && (
          <Typography variant="body2" sx={{ mb: 1 }}>
            Číslo objednávky: <code>{order}</code>
          </Typography>
        )}
        {sessionId && (
          <Typography variant="body2" sx={{ mb: 2 }}>
            Session: <code>{sessionId}</code>
          </Typography>
        )}

        {busy && (
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
            <CircularProgress size={18} />
            <Typography variant="body2">Ověřuji platbu…</Typography>
          </Stack>
        )}

        {info && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {info}
          </Alert>
        )}
        {err && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {err}
          </Alert>
        )}

        <Stack direction="row" spacing={2}>
          <Button variant="contained" onClick={() => navigate(nextUrl)}>
            Pokračovat
          </Button>
          <Button variant="text" onClick={() => navigate('/zvirata')}>
            ← Zpět na zvířata
          </Button>
        </Stack>
      </Paper>
    </Container>
  )
}