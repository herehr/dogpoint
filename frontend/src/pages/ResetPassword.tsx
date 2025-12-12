// frontend/src/pages/ResetPassword.tsx
import React, { useEffect, useMemo, useState } from 'react'
import {
  Container,
  Typography,
  TextField,
  Button,
  Stack,
  Alert,
  Paper,
  IconButton,
  InputAdornment,
} from '@mui/material'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import { useLocation, useNavigate } from 'react-router-dom'

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || ''

function safeJsonParse(raw: string): any | null {
  try {
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// optional: very light client-side validation
function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'Heslo musí mít alespoň 8 znaků.'
  // If you want stronger rules, uncomment:
  // if (!/[A-Z]/.test(pw)) return 'Heslo musí obsahovat alespoň jedno velké písmeno.'
  // if (!/[a-z]/.test(pw)) return 'Heslo musí obsahovat alespoň jedno malé písmeno.'
  // if (!/[0-9]/.test(pw)) return 'Heslo musí obsahovat alespoň jednu číslici.'
  // if (!/[^A-Za-z0-9]/.test(pw)) return 'Heslo musí obsahovat alespoň jeden speciální znak.'
  return null
}

export default function ResetPassword() {
  const location = useLocation()
  const navigate = useNavigate()

  const token = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.get('token') || ''
  }, [location.search])

  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [showPw1, setShowPw1] = useState(false)
  const [showPw2, setShowPw2] = useState(false)

  const [loading, setLoading] = useState(false)
  const [locked, setLocked] = useState(false) // lock form after success
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [capsOn, setCapsOn] = useState(false)

  // immediate feedback if token missing
  useEffect(() => {
    if (!token) {
      setError('Chybí nebo je neplatný odkaz pro obnovu hesla.')
      setLocked(true)
    } else {
      setError(null)
      setLocked(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading || locked) return

    setError(null)
    setSuccess(null)

    if (!token) {
      setError('Chybí nebo je neplatný odkaz pro obnovu hesla.')
      return
    }

    const pw = password.trim()
    const pw2 = password2.trim()

    const pwErr = validatePassword(pw)
    if (pwErr) {
      setError(pwErr)
      return
    }
    if (pw !== pw2) {
      setError('Hesla se neshodují.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: pw }),
      })

      const raw = await res.text()
      const data = safeJsonParse(raw)

      if (!res.ok) {
        // try to show backend’s exact message (e.g. expired token)
        setError(data?.error || `Obnova hesla selhala (HTTP ${res.status}).`)
        return
      }

      setSuccess(data?.message || 'Heslo bylo úspěšně změněno.')
      setLocked(true)

      // optional: redirect after a short delay
      setTimeout(() => {
        navigate('/login', { replace: true })
      }, 1600)
    } catch {
      setError('Nebylo možné uložit nové heslo. Zkuste to znovu.')
    } finally {
      setLoading(false)
    }
  }

  const disabled = loading || locked

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper sx={{ p: 4, borderRadius: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 900, mb: 1 }}>
          Nastavit nové heslo
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Zadejte nové heslo pro svůj účet.
        </Typography>

        {/* small hint */}
        {!locked && (
          <Typography color="text.secondary" sx={{ mb: 3, fontSize: 13 }}>
            Heslo musí mít alespoň <strong>8 znaků</strong>.
          </Typography>
        )}

        <form onSubmit={onSubmit}>
          <Stack spacing={2}>
            {capsOn && !disabled && (
              <Alert severity="warning">Pozor: máte zapnutý Caps Lock.</Alert>
            )}

            {error && <Alert severity="error">{error}</Alert>}
            {success && <Alert severity="success">{success}</Alert>}

            <TextField
              label="Nové heslo"
              type={showPw1 ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value.replace(/\s/g, ''))}
              fullWidth
              required
              disabled={disabled}
              autoComplete="new-password"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={showPw1 ? 'Skrýt heslo' : 'Zobrazit heslo'}
                      onClick={() => setShowPw1((v) => !v)}
                      edge="end"
                      disabled={disabled}
                    >
                      {showPw1 ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              onKeyUp={(e) => setCapsOn((e as any).getModifierState?.('CapsLock') === true)}
            />

            <TextField
              label="Potvrzení hesla"
              type={showPw2 ? 'text' : 'password'}
              value={password2}
              onChange={(e) => setPassword2(e.target.value.replace(/\s/g, ''))}
              fullWidth
              required
              disabled={disabled}
              autoComplete="new-password"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={showPw2 ? 'Skrýt heslo' : 'Zobrazit heslo'}
                      onClick={() => setShowPw2((v) => !v)}
                      edge="end"
                      disabled={disabled}
                    >
                      {showPw2 ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              onKeyUp={(e) => setCapsOn((e as any).getModifierState?.('CapsLock') === true)}
            />

            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                type="button"
                variant="text"
                onClick={() => navigate('/login')}
              >
                Zpět na přihlášení
              </Button>
              <Button type="submit" variant="contained" disabled={disabled}>
                {loading ? 'Ukládám…' : locked ? 'Hotovo' : 'Uložit nové heslo'}
              </Button>
            </Stack>
          </Stack>
        </form>
      </Paper>
    </Container>
  )
}