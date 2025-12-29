// frontend/src/pages/AdminLogin.tsx
import React, { useState } from 'react'
import { Container, Paper, Stack, Typography, TextField, Button, Alert } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { loginAdmin as login, setPasswordFirstTime } from '../api'

// ✅ add this import (from your services/api.ts)
import { setAdminToken } from '../services/api'

export default function AdminLogin() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'setpw'>('login')
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function onLogin(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setSaving(true)
    try {
      // ✅ IMPORTANT: capture response
      const res = await login(email.trim(), password)

      // ✅ store as adminToken (and sync accessToken)
      if (res?.token) setAdminToken(res.token)

      // ✅ go to admin area
      nav('/admin', { replace: true })
    } catch (e: any) {
      const msg = String(e?.message || '')
      if (msg.includes('PASSWORD_NOT_SET') || msg.includes('409')) {
        setMode('setpw')
        setErr('Tento účet ještě nemá nastavené heslo. Zadejte nové heslo níže.')
      } else {
        setErr('Přihlášení selhalo. Zkontrolujte e-mail a heslo.')
      }
    } finally {
      setSaving(false)
    }
  }

  async function onSetPassword(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setSaving(true)
    try {
      if (!newPassword || newPassword.length < 6) {
        setErr('Heslo musí mít alespoň 6 znaků.')
        setSaving(false)
        return
      }

      // This endpoint usually returns a token too
      const res = await setPasswordFirstTime(email.trim(), newPassword)

      // ✅ store as admin token if present
      if ((res as any)?.token) setAdminToken((res as any).token)

      nav('/admin', { replace: true })
    } catch (e: any) {
      setErr('Nastavení hesla selhalo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 900, mb: 2 }}>Přihlášení</Typography>
        {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

        {mode === 'login' ? (
          <form onSubmit={onLogin}>
            <Stack spacing={2}>
              <TextField
                label="E-mail"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <TextField
                label="Heslo"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button type="submit" variant="contained" disabled={saving}>
                {saving ? 'Přihlašuji…' : 'Přihlásit se'}
              </Button>
            </Stack>
          </form>
        ) : (
          <form onSubmit={onSetPassword}>
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
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                helperText="Minimálně 6 znaků"
              />
              <Stack direction="row" spacing={1}>
                <Button variant="text" onClick={() => setMode('login')}>Zpět</Button>
                <Button type="submit" variant="contained" disabled={saving}>
                  {saving ? 'Ukládám…' : 'Nastavit heslo'}
                </Button>
              </Stack>
            </Stack>
          </form>
        )}
      </Paper>
    </Container>
  )
}