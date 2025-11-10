import React, { useMemo, useState } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Stack, Alert } from '@mui/material'
import { registerAfterPayment, me } from '../services/api'
import { setToken } from '../services/api'

type Props = {
  open: boolean
  onClose: () => void
  animalId: string | null | undefined
  defaultEmail?: string
  onLoggedIn?: () => void
}

export default function AfterPaymentPasswordDialog({
  open, onClose, defaultEmail, onLoggedIn
}: Props) {
  const [email, setEmail] = useState(defaultEmail || '')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const canSubmit = useMemo(() => {
    return !!email && password.length >= 6
  }, [email, password])

  const submit = async () => {
    setSubmitting(true)
    setErr(null)
    try {
      const res = await registerAfterPayment(email, password)
      setToken(res.token) // ensure stored
      await me()
      onLoggedIn?.()
      onClose()
    } catch (e: any) {
      setErr(e?.message || 'Nepodařilo se dokončit registraci.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Dokončit registraci</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {err && <Alert severity="error">{err}</Alert>}
          <TextField
            label="E-mail"
            type="email"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            fullWidth
          />
          <TextField
            label="Heslo (min. 6 znaků)"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Zavřít</Button>
        <Button onClick={submit} disabled={!canSubmit || submitting} variant="contained">
          Uložit a přihlásit
        </Button>
      </DialogActions>
    </Dialog>
  )
}