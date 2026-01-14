// frontend/src/pages/AdminLogin.tsx
import React, { useState } from 'react'
import { Container, Paper, Stack, Typography, TextField, Button, Alert } from '@mui/material'
import { useNavigate } from 'react-router-dom'

import { login as apiLogin, setAdminToken, setPasswordFirstTime as apiSetPasswordFirstTime } from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function AdminLogin() {
  const nav = useNavigate()
  const auth = useAuth()

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
      const res = await apiLogin(email.trim().toLowerCase(), password)
      const role = res?.role

      if (role !== 'ADMIN') {
        setErr('Tento účet nemá roli ADMIN.')
        return
      }

      // ✅ persistent admin token
      setAdminToken(res.token)
      auth.login(res.token, 'ADMIN')

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
        return
      }

      const res = await apiSetPasswordFirstTime(email.trim().toLowerCase(), newPassword)

      // services/api.ts stores accessToken; we ensure adminToken too if role is ADMIN
      if (res?.role === 'ADMIN') {
        setAdminToken(res.token)
        auth.login(res.token, 'ADMIN')
        nav('/admin', { replace: true })
        return
      }

      setErr('Tento účet není ADMIN.')
    } catch {
      setErr('Nastavení hesla selhalo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 900, mb: 2 }}>
          Přihlášení administrátora
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