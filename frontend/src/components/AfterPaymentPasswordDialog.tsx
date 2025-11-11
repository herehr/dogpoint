import React, { useMemo, useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Stack, Alert, Typography
} from '@mui/material'
import { login, registerAfterPayment, me } from '../services/api'
import { useAuth } from '../context/AuthContext'

type Props = {
  open: boolean
  onClose: () => void
  defaultEmail?: string
  onLoggedIn?: () => void
}

const isPlaceholderEmail = (e?: string) =>
  !e || /pending\+unknown@local/i.test(e) || !e.includes('@')

const isValidEmail = (e: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

export default function AfterPaymentPasswordDialog({
  open,
  onClose,
  defaultEmail = '',
  onLoggedIn,
}: Props) {
  const { refreshMe } = useAuth()
  const [email, setEmail] = useState(defaultEmail)
  const [pwd, setPwd] = useState('')
  const [pwd2, setPwd2] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  React.useEffect(() => {
    setEmail(defaultEmail || '')
  }, [defaultEmail])

  const allowEditEmail = isPlaceholderEmail(email)
  const emailOk = !allowEditEmail || (email && isValidEmail(email))

  const canSubmit = useMemo(() => {
    if (!emailOk) return false
    if (!pwd || pwd.length < 6) return false
    if (pwd !== pwd2) return false
    return true
  }, [emailOk, pwd, pwd2])

  async function finishLoginFlow() {
    try { await me().catch(() => {}) } catch {}
    await refreshMe?.()
    onLoggedIn?.()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setErr(null)
    setBusy(true)

    // 1) Try to register as first-time user
    try {
      await registerAfterPayment(email, pwd)
      await finishLoginFlow()
      return
    } catch (e: any) {
      const msg = (e?.message || '').toString()
      const isConflict = /409|exist/i.test(msg)
      if (!isConflict) {
        setErr(msg || 'Nepodařilo se vytvořit účet.')
        setBusy(false)
        return
      }
    }

    // 2) If account exists, just log in
    try {
      await login(email, pwd)
      await finishLoginFlow()
    } catch (e: any) {
      setErr((e?.message || '').toString() || 'Přihlášení selhalo.')
      setBusy(false)
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
              onChange={e => setEmail(e.target.value)}
              disabled={!allowEditEmail}
              error={allowEditEmail && !!email && !emailOk}
              helperText={
                allowEditEmail
                  ? (!email ? 'Zadejte e-mail' : (!emailOk ? 'Zadejte platný e-mail' : ' '))
                  : ' '
              }
              fullWidth
              required
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