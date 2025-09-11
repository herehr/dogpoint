// frontend/src/pages/Login.tsx
import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Box, Button, Container, Stack, TextField, Typography, Alert
} from '@mui/material'
import { login as apiLogin } from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation() as any
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setSubmitting(true)
    try {
      // apiLogin should return { token, role }
      const { token, role } = await apiLogin(email.trim(), password)

      // Store in auth context (this also writes to sessionStorage)
      login(token, role || null)

      // If we were redirected here, go back to the original route
      const from = location.state?.from?.pathname as string | undefined

      // Otherwise route by role
      const target =
        from ? from :
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