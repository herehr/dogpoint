import React, { useMemo, useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Alert
} from '@mui/material'
import { registerAfterPayment, me } from '../services/api'
import { setToken } from '../services/api'

type Props = {
  open: boolean
  onClose: () => void
  onLoggedIn?: () => void
}

export default function AfterPaymentPasswordDialog({ open, onClose, onLoggedIn }: Props) {
  const [email, setEmail] = useState<string>(() => {
    try {
      const raw = localStorage.getItem('dp:pendingUser')
      if (!raw) return ''
      const o = JSON.parse(raw)
      return typeof o?.email === 'string' ? o.email : ''
    } catch { return '' }
  })
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const emailOk = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()), [email])
  const passOk  = password.trim().length >= 6

  async function submit() {
    if (!emailOk || !passOk) return
    try {
      setError(null)
      setLoading(true)
      const res = await registerAfterPayment(email.trim(), password.trim())
      setToken(res.token) // sessionStorage by default
      try { localStorage.removeItem('dp:pendingUser') } catch {}
      await me().catch(() => {})
      onLoggedIn?.()
      onClose()
    } catch (e: any) {
      setError(e?.message || 'Nepodařilo se dokončit registraci.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Dokončení registrace</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <TextField
          label="E-mail"
          fullWidth
          sx={{ mb: 2 }}
          value={email}
          InputProps={{ readOnly: true }}
        />
        <TextField
          label="Zvolte heslo (min. 6 znaků)"
          type="password"
          fullWidth
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Zavřít</Button>
        <Button onClick={submit} disabled={!emailOk || !passOk || loading} variant="contained">
          Dokončit a přihlásit
        </Button>
      </DialogActions>
    </Dialog>
  )
}