import React, { useEffect, useState } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Stack, Alert, Typography } from '@mui/material'
import { startAdoption, getAdoptionMe } from '../services/api'
import SetPasswordDialog from './SetPasswordDialog'

type Props = {
  open: boolean
  onClose: () => void
  animalId: string
  onGranted: () => void
}

export default function AdoptionDialog({ open, onClose, animalId, onGranted }: Props) {
  const [monthly, setMonthly] = useState<number>(300)
  const [email, setEmail] = useState<string>('')
  const [name, setName] = useState<string>('')
  const [knownEmail, setKnownEmail] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [askPassword, setAskPassword] = useState(false)

  // When dialog opens, if we’re authenticated try to get email from /me
  useEffect(() => {
    let alive = true
    async function loadMe() {
      try {
        const me = await getAdoptionMe()
        if (!alive) return
        if (me?.user?.email) {
          setKnownEmail(me.user.email)
          setEmail(me.user.email) // keep for payload
        }
      } catch {
        /* not logged in or endpoint not ready – ignore */
      }
    }
    if (open) loadMe()
    return () => { alive = false }
  }, [open])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null); setOk(null)

    const m = monthly
    if (!knownEmail && !email.trim()) { setErr('Vyplňte e-mail.'); return }
    if (Number.isNaN(m) || m < 300) { setErr('Minimální částka je 300 Kč.'); return }

    setSaving(true)
    try {
      const data = await startAdoption(animalId, knownEmail ?? email.trim(), name.trim() || 'Adoptující', m)

      // unlock locally & close
      setOk('Adopce potvrzena (DEMO). Obsah byl odemčen.')
      onGranted()
      onClose()

      // if user did not have password yet, ask to set it right away
      if (data?.userHasPassword === false && (knownEmail ?? email)) {
        setAskPassword(true)
      }
    } catch (e: any) {
      setErr(e?.message || 'Zahájení adopce selhalo')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle>Adopce – podpora zvířete</DialogTitle>
        <form onSubmit={submit}>
          <DialogContent>
            <Stack spacing={2}>
              {err && <Alert severity="error">{err}</Alert>}
              {ok && <Alert severity="success">{ok}</Alert>}

              <TextField
                label="Částka (Kč) *"
                type="number"
                inputProps={{ min: 300, step: 50 }}
                value={monthly}
                onChange={(e) => setMonthly(Number(e.target.value))}
                required
                fullWidth
              />

              {/* Show email/name only if we don't already know the user */}
              {!knownEmail && (
                <>
                  <TextField
                    label="E-mail *"
                    type="email"
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
              )}

              {knownEmail && (
                <Alert severity="info">Přihlášen jako <b>{knownEmail}</b>. E-mail není třeba znovu vyplňovat.</Alert>
              )}

              <Typography variant="body2" color="text.secondary">
                Platební brána bude brzy implementována. Nyní je to ukázka toku.
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Zavřít</Button>
            <Button type="submit" variant="contained" disabled={saving || Number.isNaN(monthly) || monthly < 300}>
              {saving ? 'Zpracovávám…' : 'Potvrdit adopci'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Ask for password only after successful adoption if the user didn’t have one */}
      <SetPasswordDialog
        open={askPassword}
        email={knownEmail ?? email}
        onClose={() => setAskPassword(false)}
        onSuccess={() => {/* optional: toast or redirect */}}
      />
    </>
  )
}