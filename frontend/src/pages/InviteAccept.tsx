// frontend/src/pages/InviteAccept.tsx
import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Container,
  Typography,
  Stack,
  Button,
  Paper,
  Alert,
  Box,
  CircularProgress,
} from '@mui/material'
import {
  previewShareInviteToken,
  acceptShareInviteToken,
  declineShareInviteToken,
} from '../services/api'
import { useAuth } from '../context/AuthContext'
import { emailsMatchForInvite } from '../utils/emailInviteMatch'

export default function InviteAccept() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { user, token: authToken } = useAuth()
  /** JWT present but /me not loaded yet — avoid showing „log in“ while already logged in */
  const authLoading = Boolean(authToken && !user)

  const [loading, setLoading] = React.useState(true)
  const [preview, setPreview] = React.useState<any>(null)
  const [err, setErr] = React.useState<string | null>(null)
  const [actionLoading, setActionLoading] = React.useState(false)

  React.useEffect(() => {
    let alive = true
    ;(async () => {
      if (!token) {
        setErr('Chybí odkaz')
        setLoading(false)
        return
      }
      try {
        const p = await previewShareInviteToken(token)
        if (!alive) return
        setPreview(p)
      } catch (e: any) {
        if (!alive) return
        setErr(e?.message || 'Nepodařilo se načíst pozvánku')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [token])

  const goLogin = () => {
    if (!token) return
    const q = new URLSearchParams()
    q.set('next', `/invite/${token}`)
    q.set('inviteToken', token)
    const rec = (preview as { recipientEmail?: string } | null)?.recipientEmail
    if (rec) q.set('inviteEmail', rec)
    navigate(`/login?${q.toString()}`, {
      state: { from: { pathname: `/invite/${token}` } },
      replace: false,
    })
  }

  const handleAccept = async () => {
    if (!token || !authToken) return
    setActionLoading(true)
    setErr(null)
    try {
      await acceptShareInviteToken(token)
      navigate('/user', { replace: true })
    } catch (e: any) {
      setErr(e?.message || 'Přijetí se nezdařilo')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDecline = async () => {
    if (!token) return
    setActionLoading(true)
    try {
      await declineShareInviteToken(token)
      navigate('/', { replace: true })
    } catch (e: any) {
      setErr(e?.message || 'Odmítnutí se nezdařilo')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading || authLoading) {
    return (
      <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Načítám pozvánku…</Typography>
      </Container>
    )
  }

  if (err && !preview) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Alert severity="error">{err}</Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate('/')}>
          Na domů
        </Button>
      </Container>
    )
  }

  if (!preview || !(preview as any).ok) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Alert severity="error">Neplatná pozvánka</Alert>
      </Container>
    )
  }

  const p = preview as any
  if (p.status === 'EXPIRED') {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Alert severity="warning">Tato pozvánka vypršela. Požádejte dárce o novou.</Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate('/')}>
          Na domů
        </Button>
      </Container>
    )
  }
  if (p.status === 'DECLINED') {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Alert severity="info">Pozvánka byla dříve odmítnuta.</Alert>
      </Container>
    )
  }
  if (p.status === 'ACCEPTED') {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Alert severity="success">Pozvánka už byla přijata. Přihlaste se a uvidíte zvíře v Moje adopce.</Alert>
        <Button sx={{ mt: 2 }} variant="contained" onClick={() => navigate(user ? '/user' : '/login')}>
          {user ? 'Moje adopce' : 'Přihlásit se'}
        </Button>
      </Container>
    )
  }
  if (p.status === 'DONOR_INACTIVE') {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Alert severity="warning">Předplatné dárce již není aktivní – sdílení není k dispozici.</Alert>
      </Container>
    )
  }

  if (p.status !== 'PENDING') {
    return null
  }

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Paper sx={{ p: 3, borderRadius: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 900, mb: 1 }}>
          Pozvánka ke sdílení adopce
        </Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>
          <strong>{p.senderName}</strong> vás zve ke sledování <strong>{p.animalName}</strong>.
        </Typography>
        {p.animalMain && (
          <Box
            component="img"
            src={p.animalMain}
            alt=""
            sx={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 2, mb: 2 }}
          />
        )}
        {p.message && (
          <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {p.message}
            </Typography>
          </Paper>
        )}
        {p.reason && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {p.reason}
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
          Platnost do {new Date(p.expiresAt).toLocaleString('cs-CZ')}
        </Typography>

        {err && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {err}
          </Alert>
        )}

        {user &&
          authToken &&
          p.recipientEmail &&
          !emailsMatchForInvite(user.email, p.recipientEmail) && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Jste přihlášeni jako <strong>{user.email}</strong>, ale tato pozvánka je pro{' '}
              <strong>{p.recipientEmail}</strong>. Odhlaste se a přihlaste se účtem, na který přišla
              pozvánka (nebo založte účet s tímto e-mailem).
            </Alert>
          )}

        {!user || !authToken ? (
          <Stack spacing={2}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              Chcete tuto pozvánku přijmout, nebo odmítnout?
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Button
                variant="contained"
                size="large"
                fullWidth
                onClick={goLogin}
                disabled={actionLoading}
                sx={{ borderRadius: 40, py: 1.25 }}
              >
                Přijmout pozvánku
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                size="large"
                fullWidth
                onClick={handleDecline}
                disabled={actionLoading}
                sx={{ borderRadius: 40, py: 1.25 }}
              >
                {actionLoading ? '…' : 'Odmítnout'}
              </Button>
            </Stack>
            <Alert severity="info" sx={{ mt: 0.5 }}>
              <strong>Přijmout</strong> – otevře přihlášení: zadejte heslo pro e-mail{' '}
              <strong>{p.recipientEmail}</strong> (nebo se nejdřív zaregistrujte s tímto e-mailem).{' '}
              <strong>Odmítnout</strong> – můžete hned bez účtu; dárce uvidí, že jste pozvánku nevzali.
            </Alert>
          </Stack>
        ) : (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Button variant="contained" onClick={handleAccept} disabled={actionLoading}>
              {actionLoading ? '…' : 'Přijmout sdílení'}
            </Button>
            <Button color="inherit" onClick={handleDecline} disabled={actionLoading}>
              Odmítnout
            </Button>
          </Stack>
        )}
      </Paper>
    </Container>
  )
}
