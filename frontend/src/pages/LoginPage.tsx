// frontend/src/pages/LoginPage.tsx
import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Container, Paper, Typography, TextField, Button, Stack, Alert } from '@mui/material'
import LockIcon from '@mui/icons-material/Lock'
import { loginAdmin } from '../services/api' // unified /api/auth/login

type FromState = { from?: { pathname?: string } } | null

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const navigate = useNavigate()
  const loc = useLocation()
  const state = (loc.state as FromState) || null

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setSubmitting(true)
    try {
      const data = await loginAdmin(email, password) // role comes back from server
      const role = (data.role || '').toUpperCase()
      // If coming from a protected page, go back there; otherwise route by role:
      const fallback =
        role === 'ADMIN' ? '/admin' :
        role === 'MODERATOR' ? '/moderator' :
        '/'
      const to = state?.from?.pathname || fallback
      navigate(to, { replace: true })
    } catch (e: any) {
      setErr(e?.message || 'Přihlášení selhalo')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
        <Stack spacing={3}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <LockIcon />
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              Přihlášení
            </Typography>
          </Stack>

          {err && <Alert severity="error">{err}</Alert>}

          <form onSubmit={onSubmit}>
            <Stack spacing={2}>
              <TextField
                label="E-mail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                fullWidth
                required
              />
              <TextField
                label="Heslo"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                fullWidth
                required
              />
              <Button type="submit" variant="contained" size="large" disabled={submitting}>
                {submitting ? 'Přihlašuji…' : 'Přihlásit se'}
              </Button>
            </Stack>
          </form>
        </Stack>
      </Paper>
    </Container>
  )
}