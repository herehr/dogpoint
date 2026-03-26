// frontend/src/pages/Login.tsx
import React, { useState } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import {
  Box,
  Button,
  Container,
  Stack,
  TextField,
  Typography,
  Alert,
  IconButton,
  InputAdornment,
} from '@mui/material'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'

import {
  apiUrl,
  setAdminToken,
  setModeratorToken,
  setToken,
  setPasswordFirstTime,
  login as apiLogin,
  registerInviteRecipient,
} from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation() as any
  const [searchParams] = useSearchParams()
  const { login } = useAuth()

  const inviteToken = searchParams.get('inviteToken') || ''
  const inviteEmail = searchParams.get('inviteEmail') || ''
  /** Pozvánka: nový účet (heslo 2×) vs. stávající účet (přihlášení) */
  const [inviteSubMode, setInviteSubMode] = useState<'register' | 'login'>('register')

  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [passwordConfirm, setPasswordConfirm] = useState<string>('')
  const [showPw, setShowPw] = useState<boolean>(false)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [err, setErr] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [sendingReset, setSendingReset] = useState<boolean>(false)
  const [mode, setMode] = useState<'login' | 'setpw'>('login')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setInfo(null)

    if (inviteToken && inviteSubMode === 'register') {
      if (!password || submitting) return
      if (password.length < 6) {
        setErr('Heslo musí mít alespoň 6 znaků.')
        return
      }
      if (password !== passwordConfirm) {
        setErr('Hesla se neshodují.')
        return
      }
      setSubmitting(true)
      try {
        const res = await registerInviteRecipient(inviteToken, password)
        const role = (res?.role || null) as any
        if (role === 'ADMIN') setAdminToken(res.token)
        else if (role === 'MODERATOR') setModeratorToken(res.token)
        else setToken(res.token)
        await login(res.token, role)
        const sp = new URLSearchParams(location.search || '')
        const nextPw = sp.get('next') || sp.get('redirect')
        const fromPw = location?.state?.from?.pathname as string | undefined
        const targetPw =
          nextPw && nextPw.startsWith('/')
            ? nextPw
            : fromPw || '/user'
        navigate(targetPw, { replace: true })
      } catch (e: any) {
        setErr(e?.message || 'Registrace se nezdařila. Zkuste to prosím znovu.')
      } finally {
        setSubmitting(false)
      }
      return
    }

    if (inviteToken && inviteSubMode === 'login') {
      const em = (inviteEmail || email).trim().toLowerCase()
      if (!em || !password || submitting) return
      setSubmitting(true)
      try {
        const res = await apiLogin(em, password)
        const tok = res?.token
        const role = (res?.role || null) as any
        if (role === 'ADMIN') setAdminToken(tok)
        else if (role === 'MODERATOR') setModeratorToken(tok)
        else setToken(tok)
        login(tok, role)
        const sp = new URLSearchParams(location.search || '')
        const nextParam = sp.get('next') || sp.get('redirect')
        const from = location?.state?.from?.pathname as string | undefined
        const target =
          nextParam && nextParam.startsWith('/')
            ? nextParam
            : from
              ? from
              : role === 'ADMIN'
                ? '/admin'
                : role === 'MODERATOR'
                  ? '/moderator'
                  : '/user'
        navigate(target, { replace: true })
      } catch (e: any) {
        const msg = e?.message || ''
        if (msg.includes('PASSWORD_NOT_SET') || msg.includes('409')) {
          setMode('setpw')
          setErr('Tento účet ještě nemá nastavené heslo. Přepněte na „Nemám účet – založit heslo“ nebo nastavte heslo níže.')
        } else if (msg.includes('Invalid credentials')) {
          setErr(
            'Nesprávné heslo nebo e-mail. Zkuste „Nemám účet – založit heslo“, pokud účet ještě nemáte.',
          )
        } else {
          setErr(msg || 'Přihlášení selhalo.')
        }
      } finally {
        setSubmitting(false)
      }
      return
    }

    if (!email || !password || submitting) return
    setSubmitting(true)

    try {
      if (mode === 'setpw') {
        const res = await setPasswordFirstTime(email.trim().toLowerCase(), password)
        const token = res?.token
        const role = (res?.role || null) as any
        if (role === 'ADMIN') setAdminToken(token)
        else if (role === 'MODERATOR') setModeratorToken(token)
        else setToken(token)
        login(token, role)
        const sp = new URLSearchParams(location.search || '')
        const nextPw = sp.get('next') || sp.get('redirect')
        const fromPw = location?.state?.from?.pathname as string | undefined
        const targetPw =
          nextPw && nextPw.startsWith('/')
            ? nextPw
            : fromPw ||
              (role === 'ADMIN' ? '/admin' : role === 'MODERATOR' ? '/moderator' : '/user')
        navigate(targetPw, { replace: true })
        return
      }

      const res = await apiLogin(email.trim().toLowerCase(), password)
      const token = res?.token
      const role = (res?.role || null) as any

      if (role === 'ADMIN') setAdminToken(token)
      else if (role === 'MODERATOR') setModeratorToken(token)
      else setToken(token)

      login(token, role)

      const searchParams = new URLSearchParams(location.search || '')
      const nextParam = searchParams.get('next') || searchParams.get('redirect')
      const from = location?.state?.from?.pathname as string | undefined
      const target =
        nextParam && nextParam.startsWith('/')
          ? nextParam
          : from
            ? from
            : role === 'ADMIN'
              ? '/admin'
              : role === 'MODERATOR'
                ? '/moderator'
                : '/user'

      navigate(target, { replace: true })
    } catch (e: any) {
      const msg = e?.message || ''
      if (msg.includes('PASSWORD_NOT_SET') || msg.includes('409')) {
        setMode('setpw')
        setErr('Tento účet ještě nemá nastavené heslo. Zadejte nové heslo níže.')
      } else if (msg.includes('Invalid credentials')) {
        setErr(
          'Uuups… něco se nepovedlo. Zkontrolujte prosím svůj e-mail a heslo. ' +
            'Zapomněli jste heslo? Klikněte níže a pošleme vám odkaz pro jeho obnovení.',
        )
      } else {
        setErr(msg || 'Přihlášení selhalo. Zkuste to prosím znovu později.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function onForgotPassword() {
    setErr(null)
    setInfo(null)

    if (!email.trim()) {
      setErr('Nejdříve zadejte e-mail, pro který chcete obnovit heslo.')
      return
    }

    try {
      setSendingReset(true)

      const res = await fetch(apiUrl('/api/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })

      // Security: always show same result message
      if (!res.ok) {
        await res.json().catch(() => null)
      }

      setInfo('Pokud u nás existuje účet s tímto e-mailem, poslali jsme na něj odkaz pro obnovu hesla.')
    } catch {
      setErr('Odeslání odkazu pro obnovu hesla selhalo. Zkuste to prosím znovu později.')
    } finally {
      setSendingReset(false)
    }
  }

  const showInviteRegister = Boolean(inviteToken && inviteSubMode === 'register')
  const showInviteLogin = Boolean(inviteToken && inviteSubMode === 'login')

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Typography variant="h4" sx={{ fontWeight: 900, mb: 1 }}>
        {inviteToken ? 'Přístup ze sdílené pozvánky' : 'Přihlášení'}
      </Typography>
      {inviteToken && inviteEmail && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Pozvánka pro <strong>{inviteEmail}</strong>
        </Typography>
      )}
      {inviteToken && !inviteEmail && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Zadejte heslo pro dokončení registrace (e-mail je v pozvánce).
        </Typography>
      )}

      {err && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {err}
        </Alert>
      )}

      {info && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {info}
        </Alert>
      )}

      <Box component="form" onSubmit={onSubmit} noValidate>
        <Stack spacing={2}>
          {showInviteRegister && (
            <>
              <TextField
                label="Heslo"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                fullWidth
                autoComplete="new-password"
                autoFocus
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showPw ? 'Skrýt heslo' : 'Zobrazit heslo'}
                        onClick={() => setShowPw((v) => !v)}
                        edge="end"
                      >
                        {showPw ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="Heslo znovu"
                type={showPw ? 'text' : 'password'}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
                fullWidth
                autoComplete="new-password"
              />
              <Button
                type="submit"
                variant="contained"
                disabled={submitting || !password || !passwordConfirm}
              >
                {submitting ? 'Ukládám…' : 'Založit heslo a přijmout pozvánku'}
              </Button>
              <Button
                type="button"
                variant="text"
                onClick={() => {
                  setInviteSubMode('login')
                  setPassword('')
                  setPasswordConfirm('')
                  setErr(null)
                  if (inviteEmail) setEmail(inviteEmail)
                }}
                sx={{ alignSelf: 'flex-start' }}
              >
                Už mám účet – přihlásit se
              </Button>
            </>
          )}

          {showInviteLogin && (
            <>
              <TextField
                label="E-mail"
                type="email"
                value={inviteEmail || email}
                onChange={(e) => !inviteEmail && setEmail(e.target.value)}
                required
                fullWidth
                autoComplete="email"
                autoFocus
                disabled={Boolean(inviteEmail)}
                helperText={inviteEmail ? 'E-mail je daný pozvánkou' : undefined}
              />
              <TextField
                label="Heslo"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                fullWidth
                autoComplete="current-password"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showPw ? 'Skrýt heslo' : 'Zobrazit heslo'}
                        onClick={() => setShowPw((v) => !v)}
                        edge="end"
                      >
                        {showPw ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <Button
                type="submit"
                variant="contained"
                disabled={submitting || !(inviteEmail || email).trim() || !password}
              >
                {submitting ? 'Přihlašuji…' : 'Přihlásit se'}
              </Button>
              <Button
                type="button"
                variant="text"
                onClick={() => {
                  setInviteSubMode('register')
                  setPassword('')
                  setPasswordConfirm('')
                  setErr(null)
                }}
                sx={{ alignSelf: 'flex-start' }}
              >
                Nemám účet – založit heslo
              </Button>
            </>
          )}

          {!inviteToken && (
            <>
              <TextField
                label="E-mail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                fullWidth
                autoComplete="email"
                autoFocus
              />

              <TextField
                label={mode === 'setpw' ? 'Nové heslo' : 'Heslo'}
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                fullWidth
                autoComplete={mode === 'setpw' ? 'new-password' : 'current-password'}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showPw ? 'Skrýt heslo' : 'Zobrazit heslo'}
                        onClick={() => setShowPw((v) => !v)}
                        edge="end"
                      >
                        {showPw ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Button type="submit" variant="contained" disabled={submitting || !email || !password}>
                {submitting
                  ? mode === 'setpw'
                    ? 'Nastavuji…'
                    : 'Přihlašuji…'
                  : mode === 'setpw'
                    ? 'Nastavit heslo'
                    : 'Přihlásit'}
              </Button>

              {mode === 'setpw' ? (
                <Button type="button" variant="text" onClick={() => setMode('login')} sx={{ alignSelf: 'flex-start' }}>
                  Zpět na přihlášení
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="text"
                  onClick={onForgotPassword}
                  disabled={sendingReset || !email}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  {sendingReset ? 'Odesílám odkaz…' : 'Zapomněl(a) jsem heslo'}
                </Button>
              )}
            </>
          )}
        </Stack>
      </Box>
    </Container>
  )
}