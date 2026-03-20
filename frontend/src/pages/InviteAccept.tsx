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

export default function InviteAccept() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { user, token: authToken } = useAuth()

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
    navigate(`/login?next=${encodeURIComponent(`/invite/${token}`)}`, {
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

  if (loading) {
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

        {!user || !authToken ? (
          <Stack spacing={2}>
            <Alert severity="info">
              Pro přijetí se přihlaste e-mailem <strong>{p.recipientEmail}</strong> (nebo se zaregistrujte s tímto
              e-mailem).
            </Alert>
            <Button variant="contained" onClick={goLogin}>
              Přihlásit se / Registrovat se
            </Button>
            <Button color="inherit" onClick={handleDecline} disabled={actionLoading}>
              Odmítnout
            </Button>
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
