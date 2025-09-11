import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Box, Button, Container, Stack, TextField, Typography, Alert, Paper } from '@mui/material'
import { loginAdmin as loginApi } from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation() as any
  const { loginWithToken } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setLoading(true)
    try {
      // backend returns { token, role }
      const data = await loginApi(email.trim(), password)
      loginWithToken(data.token, (data.role as any) ?? null, email.trim())

      // priority: explicit return path, else role-based landing
      const from = location.state?.from?.pathname as string | undefined
      if (from) {
        navigate(from, { replace: true })
        return
      }
      switch (data.role) {
        case 'ADMIN':
          navigate('/admin', { replace: true }); break
        case 'MODERATOR':
          navigate('/moderator', { replace: true }); break
        case 'USER':
        default:
          navigate('/user', { replace: true }); break
      }
    } catch (e: any) {
      setErr(e?.message || 'Přihlášení selhalo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 900, mb: 2 }}>
          Login
        </Typography>

        {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

        <Box component="form" onSubmit={onSubmit}>
          <Stack spacing={2}>
            <TextField label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <TextField label="Heslo" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <Button type="submit" variant="contained" disabled={loading}>{loading ? 'Přihlašuji…' : 'Přihlásit'}</Button>
          </Stack>
        </Box>

        <Typography variant="body2" sx={{ mt: 2 }} color="text.secondary">
          Nemáte heslo? Po adopci se účet vytvoří podle e-mailu. Na přihlášení můžete pak heslo nastavit/obnovit.
        </Typography>
      </Paper>
    </Container>
  )
}