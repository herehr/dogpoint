// frontend/src/pages/Login.tsx
import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Box, Button, Container, Stack, TextField, Typography, Alert, IconButton, InputAdornment
} from '@mui/material'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import { login as apiLogin } from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation() as any
  const { login } = useAuth()

  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [showPw, setShowPw] = useState<boolean>(false)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [err, setErr] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password || submitting) return
    setErr(null)
    setSubmitting(true)
    try {
      const { token, role } = await apiLogin(email.trim().toLowerCase(), password)

      // save to context (+ sessionStorage)
      login(token, (role as any) || null)

      // redirect back if protected route sent us here
      const from = location?.state?.from?.pathname as string | undefined

      // fallback by role
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

      <Box component="form" onSubmit={onSubmit} noValidate>
        <Stack spacing={2}>
          <TextField
            label="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
            autoComplete="email"
            autoFocus
          />

          <TextField
            label="Heslo"
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            fullWidth
            autoComplete="current-password"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={showPw ? 'Skrýt heslo' : 'Zobrazit heslo'}
                    onClick={() => setShowPw((v) => !v)}
                    edge="end"
                  >
                    {showPw ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSubmit(e as unknown as React.FormEvent)
            }}
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