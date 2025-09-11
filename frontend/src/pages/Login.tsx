// frontend/src/pages/Login.tsx
import React, { useState } from 'react'
import {
  Box, Button, Container, Stack, TextField, Typography, Alert, CircularProgress
} from '@mui/material'
import { useNavigate, useLocation } from 'react-router-dom'
import { login as apiLogin } from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation() as any
  const { setAuth, logout } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setLoading(true)
    try {
      // Unified backend login (/api/auth/login) — returns { token, role }
      const { token, role } = await apiLogin(email.trim(), password)

      // optional: update your AuthContext if it exposes a setter
      setAuth?.({
        token,
        role: role || 'USER',
        user: { email }, // if you have a richer user object, set it here
      })

      // Where to go next
      const toFromGuard = location.state?.from as string | undefined
      if (toFromGuard) {
        navigate(toFromGuard, { replace: true })
        return
      }

      // Role-based landing
      if (role === 'ADMIN') navigate('/admin', { replace: true })
      else if (role === 'MODERATOR') navigate('/moderator', { replace: true })
      else navigate('/user', { replace: true })
    } catch (e: any) {
      // your api helper throws with message "401 Unauthorized for /api/auth/login → …"
      const msg = e?.message || 'Přihlášení selhalo'
      // make friendlier messages
      if (msg.includes('401')) setErr('Neplatný e-mail nebo heslo.')
      else setErr(msg)
      // ensure any stale session is cleared
      logout?.()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Box component="form" onSubmit={onSubmit}>
        <Stack spacing={2}>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Přihlášení
          </Typography>

          {err && <Alert severity="error">{err}</Alert>}

          <TextField
            label="E-mail"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
          />

          <TextField
            label="Heslo"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            fullWidth
          />

          <Stack direction="row" spacing={1} alignItems="center">
            <Button type="submit" variant="contained" disabled={loading}>
              Přihlásit
            </Button>
            {loading && <CircularProgress size={22} />}
            <Button
              type="button"
              onClick={() => navigate('/')}
              color="inherit"
            >
              Zpět
            </Button>
          </Stack>

          <Typography variant="body2" color="text.secondary">
            Zapomněli jste heslo? Připravíme obnovu hesla na další krok.
          </Typography>
        </Stack>
      </Box>
    </Container>
  )
}