// frontend/src/components/AdoptionDialog.tsx
import React, { useEffect, useRef, useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Stack, Alert, Typography, Chip, Box
} from '@mui/material'
import { startAdoption, getAdoptionMe } from '../services/api'
import SetPasswordDialog from './SetPasswordDialog'
import { useAccess } from '../context/AccessContext'

type Props = {
  open: boolean
  onClose: () => void
  animalId: string
  onGranted: () => void
}

export default function AdoptionDialog({ open, onClose, animalId, onGranted }: Props) {
  const { hasAccess, grantAccess } = useAccess()

  // form state
  const [monthly, setMonthly] = useState<number>(300)
  const amountInputRef = useRef<HTMLInputElement>(null)

  const [email, setEmail] = useState<string>('')
  const [name, setName] = useState<string>('')

  // context state
  const [knownEmail, setKnownEmail] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [askPassword, setAskPassword] = useState(false)

  const alreadyAdopted = hasAccess(animalId)

  // Reset messages when dialog opens
  useEffect(() => {
    if (!open) return
    setErr(null); setOk(null)
  }, [open])

  // Load current user email (if logged in)
  useEffect(() => {
    let alive = true
    async function loadMe() {
      try {
        const me = await getAdoptionMe()
        if (!alive) return
        if (me?.user?.email) {
          setKnownEmail(me.user.email)
          setEmail(me.user.email)
        }
      } catch { /* ignore */ }
    }
    if (open) loadMe()
    return () => { alive = false }
  }, [open])

  const presetAmounts = [300, 500, 1000]

  function pickAmount(a?: number) {
    if (a) {
      setMonthly(a)
    } else {
      // “Vlastní částka” → focus the input
      setMonthly(NaN)
      setTimeout(() => amountInputRef.current?.focus(), 0)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    setErr(null); setOk(null)

    if (alreadyAdopted) {
      setOk('Toto zvíře již máte adoptované.')
      return
    }

    const m = monthly
    if (!knownEmail && !email.trim()) { setErr('Vyplňte e-mail.'); return }
    if (Number.isNaN(m) || m < 300) { setErr('Minimální částka je 300 Kč.'); return }

    setSaving(true)
    try {
      const data = await startAdoption(
        animalId,
        knownEmail ?? email.trim(),
        name.trim() || 'Adoptující',
        m
      )

      grantAccess(animalId)
      setOk('Adopce potvrzena (DEMO). Obsah byl odemčen.')
      onGranted()
      onClose()

      if (data?.userHasPassword === false && (knownEmail ?? email)) {
        setAskPassword(true)
      }
    } catch (e: any) {
      setErr(e?.message || 'Zahájení adopce selhalo')
    } finally {
      setSaving(false)
    }
  }

  const monthlyDisplay = Number.isNaN(monthly) ? '' : String(monthly)

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle>Adopce – měsíční podpora</DialogTitle>

        {alreadyAdopted ? (
          <>
            <DialogContent>
              <Alert severity="info">
                Toto zvíře jste již adoptovali. Najdete ho v sekci <b>Můj účet</b>.
              </Alert>
            </DialogContent>
            <DialogActions>
              <Button onClick={onClose} autoFocus>Zavřít</Button>
            </DialogActions>
          </>
        ) : (
          <form onSubmit={submit}>
            <DialogContent>
              <Stack spacing={2}>
                {err && <Alert severity="error">{err}</Alert>}
                {ok && <Alert severity="success">{ok}</Alert>}

                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                  Výše měsíční podpory (Kč)
                </Typography>

                {/* Amount chips: 300 / 500 / 1000 / Vlastní částka */}
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {presetAmounts.map(a => (
                    <Chip
                      key={a}
                      label={`${a} Kč`}
                      clickable
                      color={monthly === a ? 'primary' : 'default'}
                      onClick={() => pickAmount(a)}
                      sx={{ borderRadius: 2, fontWeight: 700 }}
                    />
                  ))}
                  <Chip
                    label="Vlastní částka"
                    clickable
                    color={!presetAmounts.includes(monthly) ? 'primary' : 'default'}
                    onClick={() => pickAmount(undefined)}
                    sx={{ borderRadius: 2 }}
                  />
                </Box>

                {/* Amount input (always visible; highlighted when “Vlastní částka”) */}
                <TextField
                  inputRef={amountInputRef}
                  label="Částka (Kč) * — měsíčně"
                  type="number"
                  inputMode="numeric"
                  inputProps={{ min: 300, step: 50 }}
                  value={monthlyDisplay}
                  onChange={(e) => {
                    const v = e.target.value
                    setMonthly(v === '' ? NaN : Number(v))
                  }}
                  required
                  fullWidth
                />

                {/* Email / Name */}
                {!knownEmail ? (
                  <>
                    <TextField
                      label="E-mail *"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      fullWidth
                    />
                    <TextField
                      label="Jméno"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      fullWidth
                    />
                  </>
                ) : (
                  <Alert severity="info">
                    Přihlášen jako <b>{knownEmail}</b>. E-mail není třeba znovu vyplňovat.
                  </Alert>
                )}

                <Typography variant="body2" color="text.secondary">
                  Platební brána bude brzy implementována. Jedná se o měsíční podporu (lze kdykoli ukončit).
                </Typography>
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={onClose}>Zavřít</Button>
              <Button
                type="submit"
                variant="contained"
                disabled={
                  saving ||
                  Number.isNaN(monthly) ||
                  monthly < 300 ||
                  (!knownEmail && !email.trim())
                }
              >
                {saving ? 'Zpracovávám…' : 'Potvrdit adopci'}
              </Button>
            </DialogActions>
          </form>
        )}
      </Dialog>

      {/* Ask for password only after successful adoption if the user didn’t have one */}
      <SetPasswordDialog
        open={askPassword}
        email={knownEmail ?? email}
        onClose={() => setAskPassword(false)}
        onSuccess={() => { /* optional toast/redirect */ }}
      />
    </>
  )
}