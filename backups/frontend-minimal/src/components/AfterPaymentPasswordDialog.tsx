// frontend/src/components/AfterPaymentPasswordDialog.tsx
import React, { useState, useEffect } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Alert, Stack
} from '@mui/material'
import { registerAfterPayment, me } from '../services/api'
import { setToken } from '../services/api'
import { useAccess } from '../context/AccessContext'

type Props = {
  open: boolean
  onClose: () => void
  animalId?: string | null
  onLoggedIn?: () => void
  /** optional: prefill email from parent instead of reading localStorage */
  defaultEmail?: string
  /**
   * optional: let parent add extra logic on success
   * (token is already stored via setToken)
   */
  onSubmit?: (payload: { email: string; token: string; role: 'USER'|'MODERATOR'|'ADMIN' }) => void
}

export default function AfterPaymentPasswordDialog({
  open,
  onClose,
  animalId,
  onLoggedIn,
  defaultEmail,
  onSubmit,
}: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const { grantAccess } = useAccess()

  // Prefill email (parent > localStorage)
  useEffect(() => {
    if (!open) return
    if (defaultEmail) {
      setEmail(defaultEmail)
      return
    }
    try {
      const stash = localStorage.getItem('dp:pendingUser')
      if (stash) {
        const parsed = JSON.parse(stash)
        if (parsed?.email) { setEmail(parsed.email); return }
      }
      const fallback = localStorage.getItem('dp:pendingEmail')
      if (fallback) setEmail(fallback)
    } catch {}
  }, [open, defaultEmail])

  async function submit() {
    setErr(null)
    setLoading(true)
    try {
      if (!email || !password) throw new Error('Vyplňte e-mail i heslo.')

      const res = await registerAfterPayment(email, password) // -> { ok, token, role }
      if (!res?.token) throw new Error('Chyba přihlášení.')

      // Store token for Authorization
      setToken(res.token)

      // Immediately unlock the adopted animal (provisional)
      if (animalId) grantAccess(animalId)

      // Refresh header state
      await me()

      // Let parent hook in if needed
      onSubmit?.({ email, token: res.token, role: res.role })

      // Cleanup and close
      try {
        localStorage.removeItem('dp:pendingUser')
        localStorage.removeItem('dp:pendingEmail')
      } catch {}
      onClose()
      onLoggedIn?.()
    } catch (e: any) {
      setErr(e?.message || 'Registrace po platbě se nezdařila.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Dokončit registraci</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {err && <Alert severity="error">{err}</Alert>}
          <TextField
            label="E-mail"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            fullWidth
          />
          <TextField
            label="Heslo"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            helperText="Minimálně 6 znaků."
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Zavřít</Button>
        <Button onClick={submit} variant="contained" disabled={loading}>
          {loading ? 'Ukládám…' : 'Potvrdit a přihlásit'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}