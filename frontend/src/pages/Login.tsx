// frontend/src/pages/Login.tsx
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Button, Container, Stack, TextField, Typography, Alert
} from '@mui/material'
import { login as apiLogin } from '../services/api'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setSubmitting(true)
    try {
      const { role } = await apiLogin(email.trim(), password)
      // persist role so guards can read it on refresh
      if (role) sessionStorage.setItem('role', role)

      // route by role
      const target =
        role === 'ADMIN' ? '/admin' :
        role === 'MODERATOR' ? '/moderator' :
        '/user'

      navigate(target, { replace: true })
    } catch (e: any) {
      setErr(e?.message || 'Přihlášení selhalo')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Typography variant="h4" sx={{ fontWeight: 900, mb: 2 }}>
        Přihlášení
      </Typography>

      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      <Box component="form" onSubmit={onSubmit}>
        <Stack spacing={2}>
          <TextField
            label="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
          />
          <TextField
            label="Heslo"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            fullWidth
          />
          <Button
            type="submit"
            variant="contained"
            disabled={submitting || !email || !password}
          >
            {submitting ? 'Přihlašuji…' : 'Přihlásit'}
          </Button>
        </Stack>
      </Box>
    </Container>
  )
}