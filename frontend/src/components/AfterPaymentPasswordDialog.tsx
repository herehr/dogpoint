import React, { useMemo, useRef, useState, useEffect } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Stack, Alert, Typography
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import {
  login,
  registerAfterPayment,
  me,
  setAuthToken,
} from '../services/api'

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
  const navigate = useNavigate()
  const emailInputRef = useRef<HTMLInputElement | null>(null)
  const pwdInputRef = useRef<HTMLInputElement | null>(null)

  const [email, setEmail] = useState(defaultEmail)
  const [pwd, setPwd] = useState('')
  const [pwd2, setPwd2] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // keep email in sync if parent updates default
  useEffect(() => {
    setEmail(defaultEmail || '')
  }, [defaultEmail])

  // autofocus: email if editable, otherwise password
  useEffect(() => {
    if (!open) return
    const canEdit = isPlaceholderEmail(email)
    const el = (canEdit ? emailInputRef.current : pwdInputRef.current)
    // small delay to let dialog mount
    const t = setTimeout(() => el?.focus(), 50)
    return () => clearTimeout(t)
  }, [open, email])

  const allowEditEmail = isPlaceholderEmail(email)
  const emailOk = !allowEditEmail || (email && isValidEmail(email))

  const canSubmit = useMemo(() => {
    if (!emailOk) return false
    if (!pwd || pwd.length < 6) return false
    if (pwd !== pwd2) return false
    return true
  }, [emailOk, pwd, pwd2])

  async function finishLoginFlow(token?: string) {
    if (token) setAuthToken(token)
    try {
      await me().catch(() => {})
    } catch {}
    // clear any stash we may have left
    try {
      localStorage.removeItem('dp:pendingEmail')
      localStorage.removeItem('dp:pendingUser')
    } catch {}
    onLoggedIn?.()
    // go straight to the user dashboard → Moje adopce
    navigate('/user/adopce', { replace: true })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || busy) return
    setErr(null)
    setBusy(true)

    // 1) try first-time registration (backend should also link pledges)
    try {
      const reg = await registerAfterPayment(email, pwd)
      await finishLoginFlow(reg?.token)
      return
    } catch (e: any) {
      const msg = (e?.message || '').toString()
      // conflict/exists → fall through to login
      const isConflict = /\b409\b|exist/i.test(msg)
      if (!isConflict) {
        setErr(msg || 'Nepodařilo se vytvořit účet.')
        setBusy(false)
        return
      }
    }

    // 2) fallback: login existing account
    try {
      const auth = await login(email, pwd)
      await finishLoginFlow(auth?.token)
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
              inputRef={emailInputRef}
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={!allowEditEmail || busy}
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
              inputRef={pwdInputRef}
              value={pwd}
              onChange={e => setPwd(e.target.value)}
              fullWidth
              required
              disabled={busy}
              helperText="Minimálně 6 znaků"
            />
            <TextField
              label="Heslo znovu"
              type="password"
              value={pwd2}
              onChange={e => setPwd2(e.target.value)}
              fullWidth
              required
              disabled={busy}
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