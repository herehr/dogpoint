// frontend/src/pages/ResetPassword.tsx
import React, { useState } from 'react'
import {
  Container,
  Typography,
  TextField,
  Button,
  Stack,
  Alert,
  Paper,
} from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

function useTokenFromQuery(): string {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  return params.get('token') || ''
}

export default function ResetPassword() {
  const location = useLocation()
  const navigate = useNavigate()
  const params = new URLSearchParams(location.search)
  const token = params.get('token') || ''

  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!token) {
      setError('Chybí nebo je neplatný odkaz pro obnovu hesla.')
      return
    }
    if (password.length < 8) {
      setError('Heslo musí mít alespoň 8 znaků.')
      return
    }
    if (password !== password2) {
      setError('Hesla se neshodují.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error || 'Obnova hesla selhala.')
      } else {
        setSuccess(data?.message || 'Heslo bylo úspěšně změněno.')
      }
    } catch (e: any) {
      setError('Nebylo možné uložit nové heslo. Zkuste to znovu.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper sx={{ p: 4, borderRadius: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 900, mb: 1 }}>
          Nastavit nové heslo
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Zadejte nové heslo pro svůj účet.
        </Typography>

        <form onSubmit={onSubmit}>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            {success && <Alert severity="success">{success}</Alert>}

            <TextField
              label="Nové heslo"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="Potvrzení hesla"
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              fullWidth
              required
            />

            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                type="button"
                variant="text"
                onClick={() => navigate('/login')}
              >
                Zpět na přihlášení
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={loading}
              >
                {loading ? 'Ukládám…' : 'Uložit nové heslo'}
              </Button>
            </Stack>
          </Stack>
        </form>
      </Paper>
    </Container>
  )
}