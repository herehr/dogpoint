// frontend/src/pages/AdminLogin.tsx
import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Container, Paper, Typography, TextField, Button, Stack, Alert
} from '@mui/material'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import { loginAdmin } from '../services/api'

type FromState = { from?: { pathname?: string } } | null

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const navigate = useNavigate()
  const state = (useLocation().state as FromState) || null

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setSubmitting(true)
    try {
      await loginAdmin(email, password) // stores sessionStorage token
      const to = state?.from?.pathname || '/admin'
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
            <AdminPanelSettingsIcon />
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              Přihlášení administrátora
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
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={submitting}
              >
                {submitting ? 'Přihlašuji…' : 'Přihlásit se'}
              </Button>
            </Stack>
          </form>
        </Stack>
      </Paper>
    </Container>
  )
}