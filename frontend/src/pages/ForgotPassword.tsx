// frontend/src/pages/ForgotPassword.tsx
import React, { useState } from 'react'
import {
  Container,
  Typography,
  TextField,
  Button,
  Stack,
  Alert,
  Box,
} from '@mui/material'
import { useParams, useNavigate } from 'react-router-dom'

const API_BASE_URL =
  (import.meta as any)?.env?.VITE_API_BASE_URL || ''

export default function ForgotPassword() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) {
      setErr('Chybí token pro obnovu hesla.')
      return
    }
    if (!password || !password2) {
      setErr('Vyplňte prosím obě pole hesla.')
      return
    }
    if (password !== password2) {
      setErr('Hesla se neshodují.')
      return
    }
    if (password.length < 6) {
      setErr('Heslo musí mít alespoň 6 znaků.')
      return
    }

    setErr(null)
    setOk(null)
    setSubmitting(true)

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        const msg =
          body?.error ||
          'Obnova hesla selhala. Odkaz mohl vypršet, zkuste to prosím znovu.'
        throw new Error(msg)
      }

      setOk('Heslo bylo úspěšně změněno. Můžete se přihlásit novým heslem.')
      // malá pauza a návrat na login
      setTimeout(() => {
        navigate('/login', { replace: true })
      }, 2000)
    } catch (e: any) {
      setErr(e?.message || 'Obnova hesla selhala.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Typography variant="h4" sx={{ fontWeight: 900, mb: 2 }}>
        Obnova hesla
      </Typography>

      {err && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {err}
        </Alert>
      )}
      {ok && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {ok}
        </Alert>
      )}

      {!token && (
        <Alert severity="error">
          Chybí nebo je neplatný odkaz pro obnovu hesla.
        </Alert>
      )}

      {token && (
        <Box component="form" onSubmit={onSubmit} noValidate>
          <Stack spacing={2}>
            <TextField
              label="Nové heslo"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Nové heslo znovu"
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              required
              fullWidth
            />
            <Button
              type="submit"
              variant="contained"
              disabled={submitting || !password || !password2}
            >
              {submitting ? 'Ukládám…' : 'Nastavit nové heslo'}
            </Button>
          </Stack>
        </Box>
      )}
    </Container>
  )
}