import React, { useEffect, useMemo, useState } from 'react'
import { Container, Paper, Stack, Typography, TextField, Button, Alert } from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'
import { setPasswordFirstTime } from '../api'

function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

export default function SetPasswordFromInvite() {
  const nav = useNavigate()
  const loc = useLocation()

  const token = useMemo(() => new URLSearchParams(loc.search).get('token') || '', [loc.search])
  const payload = useMemo(() => (token ? decodeJwtPayload(token) : null), [token])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const mail = payload?.email || ''
    if (mail) setEmail(String(mail))
  }, [payload])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)

    if (!email) return setErr('Chybí e-mail.')
    if (!password || password.length < 6) return setErr('Heslo musí mít alespoň 6 znaků.')

    setSaving(true)
    try {
      await setPasswordFirstTime(email.trim(), password)
      // after setting password, user should log in as moderator
      nav('/moderator/login', { replace: true })
    } catch (e: any) {
      setErr(e?.message || 'Nastavení hesla selhalo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 900, mb: 2 }}>
          Nastavit heslo
        </Typography>

        {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

        {!token && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Chybí token v odkazu.
          </Alert>
        )}

        <form onSubmit={onSubmit}>
          <Stack spacing={2}>
            <TextField
              label="E-mail"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              label="Nové heslo"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              helperText="Minimálně 6 znaků"
            />
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? 'Ukládám…' : 'Nastavit heslo'}
            </Button>
          </Stack>
        </form>
      </Paper>
    </Container>
  )
}