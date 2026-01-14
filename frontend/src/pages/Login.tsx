// frontend/src/pages/Login.tsx
import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Box,
  Button,
  Container,
  Stack,
  TextField,
  Typography,
  Alert,
  IconButton,
  InputAdornment,
} from '@mui/material'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'

import { apiUrl, setAdminToken, setModeratorToken, setToken } from '../services/api'
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
  const [info, setInfo] = useState<string | null>(null)
  const [sendingReset, setSendingReset] = useState<boolean>(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password || submitting) return
    setErr(null)
    setInfo(null)
    setSubmitting(true)

    try {
      const res = await apiLogin(email.trim().toLowerCase(), password)
      const token = res?.token
      const role = (res?.role || null) as any

      // ✅ store token persistently (localStorage-first)
      if (role === 'ADMIN') setAdminToken(token)
      else if (role === 'MODERATOR') setModeratorToken(token)
      else setToken(token)

      // ✅ update AuthContext UI state
      login(token, role)

      // redirect back if protected route sent us here
      const from = location?.state?.from?.pathname as string | undefined

      // fallback by role
      const target = from
        ? from
        : role === 'ADMIN'
          ? '/admin'
          : role === 'MODERATOR'
            ? '/moderator'
            : '/user'

      navigate(target, { replace: true })
    } catch (e: any) {
      const msg = e?.message || ''
      if (msg.includes('Invalid credentials')) {
        setErr(
          'Uuups… něco se nepovedlo. Zkontrolujte prosím svůj e-mail a heslo. ' +
            'Zapomněli jste heslo? Klikněte níže a pošleme vám odkaz pro jeho obnovení.',
        )
      } else {
        setErr(msg || 'Přihlášení selhalo. Zkuste to prosím znovu později.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function onForgotPassword() {
    setErr(null)
    setInfo(null)

    if (!email.trim()) {
      setErr('Nejdříve zadejte e-mail, pro který chcete obnovit heslo.')
      return
    }

    try {
      setSendingReset(true)

      const res = await fetch(apiUrl('/api/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })

      // Security: always show same result message
      if (!res.ok) {
        await res.json().catch(() => null)
      }

      setInfo('Pokud u nás existuje účet s tímto e-mailem, poslali jsme na něj odkaz pro obnovu hesla.')
    } catch {
      setErr('Odeslání odkazu pro obnovu hesla selhalo. Zkuste to prosím znovu později.')
    } finally {
      setSendingReset(false)
    }
  }

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Typography variant="h4" sx={{ fontWeight: 900, mb: 2 }}>
        Přihlášení
      </Typography>

      {err && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {err}
        </Alert>
      )}

      {info && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {info}
        </Alert>
      )}

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
          />

          <Button type="submit" variant="contained" disabled={submitting || !email || !password}>
            {submitting ? 'Přihlašuji…' : 'Přihlásit'}
          </Button>

          <Button
            type="button"
            variant="text"
            onClick={onForgotPassword}
            disabled={sendingReset || !email}
            sx={{ alignSelf: 'flex-start' }}
          >
            {sendingReset ? 'Odesílám odkaz…' : 'Zapomněl(a) jsem heslo'}
          </Button>
        </Stack>
      </Box>
    </Container>
  )
}