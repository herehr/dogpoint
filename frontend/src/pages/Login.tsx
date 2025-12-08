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
import { login as apiLogin } from '../api'
import { useAuth } from '../context/AuthContext'

const API_BASE_URL =
  (import.meta as any)?.env?.VITE_API_BASE_URL || ''

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
      const { token, role } = await apiLogin(
        email.trim().toLowerCase(),
        password
      )

      // save to context (+ sessionStorage)
      login(token, (role as any) || null)

      // redirect back if protected route sent us here
      const from = location?.state?.from?.pathname as string | undefined

      // fallback by role
      const target =
        from
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
          'Špatný e-mail nebo heslo. Pokud jste heslo zapomněli, můžete si níže poslat odkaz pro jeho obnovení.'
        )
      } else {
        setErr(msg || 'Přihlášení selhalo')
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

      const res = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })

      // Pro bezpečnost vždy zobrazíme stejnou zprávu,
      // i kdyby e-mail v systému nebyl.
      if (!res.ok) {
        // zkusíme přečíst serverovou chybu, ale navenek to moc nerozlišujeme
        await res.json().catch(() => null)
      }

      setInfo(
        'Pokud u nás existuje účet s tímto e-mailem, poslali jsme na něj odkaz pro obnovu hesla.'
      )
    } catch {
      setErr(
        'Odeslání odkazu pro obnovu hesla selhalo. Zkuste to prosím znovu později.'
      )
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

          {/* Forgot password action */}
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