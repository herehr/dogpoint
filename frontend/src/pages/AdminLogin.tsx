// frontend/src/pages/AdminLogin.tsx
import React, { useState } from 'react'
import { Container, Paper, Stack, Typography, TextField, Button, Alert } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { loginAdmin as login, setPasswordFirstTime } from '../api'

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
      await login(email.trim(), password) // stores accessToken/adminToken in api.ts
      nav('/admin', { replace: true })    // ✅ go to admin area
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

      await setPasswordFirstTime(email.trim(), newPassword) // api.ts stores token (accessToken/adminToken)
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
        <Typography variant="h5" sx={{ fontWeight: 900, mb: 2 }}>
          Přihlášení
        </Typography>

        {err && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {err}
          </Alert>
        )}

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
                <Button variant="text" onClick={() => setMode('login')}>
                  Zpět
                </Button>
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