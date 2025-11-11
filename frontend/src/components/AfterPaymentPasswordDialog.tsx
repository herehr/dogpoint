// frontend/src/components/AfterPaymentPasswordDialog.tsx
import React, { useEffect, useMemo, useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Stack, Alert, IconButton, InputAdornment
} from '@mui/material'
import { Visibility, VisibilityOff } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import {
  setPasswordFirstTime, login, me, setAuthToken,
} from '../services/api'

type Props = {
  open: boolean
  onClose: () => void
  animalId?: string | null
  /** prefilled email from AnimalDetail (user.email or stashed) */
  defaultEmail?: string
  /** called after successful login/token set so the detail can unblur */
  onLoggedIn?: () => void
}

export default function AfterPaymentPasswordDialog({
  open,
  onClose,
  animalId,
  defaultEmail,
  onLoggedIn,
}: Props) {
  const navigate = useNavigate()

  const [email, setEmail] = useState(defaultEmail || '')
  const [pwd, setPwd] = useState('')
  const [pwd2, setPwd2] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setEmail(defaultEmail || '')
      setPwd('')
      setPwd2('')
      setErr(null)
      setOkMsg(null)
    }
  }, [open, defaultEmail])

  const canSubmit = useMemo(() => {
    return email.trim().length > 3 && pwd.length >= 6 && pwd === pwd2 && !busy
  }, [email, pwd, pwd2, busy])

  const finishLogin = async (token: string | undefined | null) => {
    if (token) setAuthToken(token)
    try { await me() } catch {}
    // clear pending stash, best-effort
    try {
      localStorage.removeItem('dp:pendingUser')
      localStorage.removeItem('dp:pendingEmail')
    } catch {}

    if (onLoggedIn) onLoggedIn()

    // go straight to Moje adopce (User dashboard)
    navigate('/user', { replace: true })
    onClose()
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    setBusy(true)
    setErr(null)
    setOkMsg(null)

    const e = email.trim().toLowerCase()
    try {
      // 1) Try first-time password flow
      const r = await setPasswordFirstTime(e, pwd)
      setOkMsg('Účet byl nastaven. Přihlašuji…')
      await finishLogin(r?.token)
      return
    } catch (ex: any) {
      // If 409/400, it can mean the user already exists. Fall back to classic login.
      const msg = String(ex?.message || '')
      if (!/unauthorized|invalid/i.test(msg)) {
        // non-auth-type errors: show and stop
        // eslint-disable-next-line no-console
        console.warn('[after-pay:set-password-first-time] failed, will try login:', msg)
      }
    }

    try {
      // 2) Fall back to classic login
      const r2 = await login(e, pwd)
      setOkMsg('Přihlašuji…')
      await finishLogin(r2?.token)
    } catch (ex2: any) {
      const msg = String(ex2?.message || 'Nelze se přihlásit.')
      setErr(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Dokončení registrace</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Alert severity="info">
            Platba proběhla. Zadejte e-mail a heslo, abyste měli trvalý přístup ke své adopci.
          </Alert>

          <TextField
            label="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            disabled={busy}
            fullWidth
          />

          <TextField
            label="Heslo (min. 6 znaků)"
            type={showPwd ? 'text' : 'password'}
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            autoComplete="new-password"
            disabled={busy}
            fullWidth
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPwd(s => !s)} edge="end" aria-label="Zobrazit heslo">
                    {showPwd ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <TextField
            label="Heslo znovu"
            type={showPwd ? 'text' : 'password'}
            value={pwd2}
            onChange={(e) => setPwd2(e.target.value)}
            autoComplete="new-password"
            disabled={busy}
            fullWidth
          />

          {err && <Alert severity="error">{err}</Alert>}
          {okMsg && <Alert severity="success">{okMsg}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>Zavřít</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          Uložit heslo a pokračovat
        </Button>
      </DialogActions>
    </Dialog>
  )
}