import React, { useMemo, useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Stack, Alert, Typography
} from '@mui/material'
import { login, registerAfterPayment, me, setAuthToken } from '../services/api'

type Props = {
  open: boolean
  onClose: () => void
  /** Prefilled email after Stripe return; we keep this disabled to avoid mismatch with pledge */
  defaultEmail?: string
  /** Called when the user has a valid session (after register or login) */
  onLoggedIn?: () => void
}

/**
 * Shown after successful Stripe Checkout redirect.
 * Primary path:
 *   - First-time donor: set a password → we call registerAfterPayment(email, password)
 *   - Existing donor: if register fails with 409 → fallback to login(email, password)
 * Either way, on success: set token, fetch /me, call onLoggedIn().
 */
export default function AfterPaymentPasswordDialog({
  open,
  onClose,
  defaultEmail = '',
  onLoggedIn,
}: Props) {
  const [email, setEmail] = useState(defaultEmail)
  const [pwd, setPwd] = useState('')
  const [pwd2, setPwd2] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Keep email in sync with prop (for when AnimalDetail updates it from confirm response)
  React.useEffect(() => {
    setEmail(defaultEmail || '')
  }, [defaultEmail])

  const canSubmit = useMemo(() => {
    if (!email) return false
    if (!pwd || pwd.length < 6) return false
    if (pwd !== pwd2) return false
    return true
  }, [email, pwd, pwd2])

  async function finishLoginFlow(token?: string) {
    if (token) setAuthToken(token)
    try {
      await me().catch(() => {})
    } catch {}
    onLoggedIn?.()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!canSubmit) return
    setBusy(true)
    try {
      // 1) Try registering for the first time (backend will connect pledge → user)
      const reg = await registerAfterPayment(email, pwd)
      await finishLoginFlow(reg?.token)
      return
    } catch (e: any) {
      const msg = (e?.message || '').toString()
      // If user already exists, fall back to login
      const isConflict = /409|exist/i.test(msg)
      if (!isConflict) {
        // unknown failure during register
        setErr(msg || 'Nepodařilo se vytvořit účet.')
        setBusy(false)
        return
      }
    }

    // 2) Fallback → user exists → login
    try {
      const auth = await login(email, pwd)
      await finishLoginFlow(auth?.token)
    } catch (e: any) {
      const msg = (e?.message || '').toString()
      setErr(msg || 'Přihlášení selhalo.')
      setBusy(false)
      return
    }
  }

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <form onSubmit={handleSubmit}>
        <DialogTitle>Nastavit heslo</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Platba byla úspěšná. Prosím nastavte si heslo k&nbsp;účtu, abyste
              měli trvalý přístup k&nbsp;„Moje adopce“.
            </Typography>

            {!!err && <Alert severity="error">{err}</Alert>}

            <TextField
              label="E-mail"
              value={email}
              disabled
              fullWidth
            />
            <TextField
              label="Heslo"
              type="password"
              value={pwd}
              onChange={e => setPwd(e.target.value)}
              fullWidth
              required
              helperText="Minimálně 6 znaků"
            />
            <TextField
              label="Heslo znovu"
              type="password"
              value={pwd2}
              onChange={e => setPwd2(e.target.value)}
              fullWidth
              required
              error={!!pwd2 && pwd2 !== pwd}
              helperText={pwd2 && pwd2 !== pwd ? 'Hesla se neshodují' : ' '}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>Později</Button>
          <Button type="submit" variant="contained" disabled={!canSubmit || busy}>
            Uložit a pokračovat
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}