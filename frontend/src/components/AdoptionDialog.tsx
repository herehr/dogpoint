// frontend/src/components/AdoptionDialog.tsx
import React, { useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Stack, Alert, Typography
} from '@mui/material'
import { startAdoption } from '../services/api'

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
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null); setOk(null)

    const m = monthly
if (!email.trim()) { setErr('Vyplňte e-mail.'); return }
if (Number.isNaN(m) || m < 300) { setErr('Minimální částka je 300 Kč.'); return }

    setSaving(true)
    try {
      // ✅ use the updated API helper with email/name/monthly
      const data = await startAdoption(animalId, email.trim(), name.trim() || 'Adoptující', m)

      if (data?.token) {
        sessionStorage.setItem('accessToken', data.token)
      }

      setOk('Adopce potvrzena (DEMO). Obsah byl odemčen.')
      onGranted()
      onClose()
    } catch (e: any) {
      setErr(e?.message || 'Zahájení adopce selhalo')
    } finally {
      setSaving(false)
    }
  }

  return (
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

            <Typography variant="body2" color="text.secondary">
              Platební brána bude brzy implementována. Nyní je to ukázka toku.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Zavřít</Button>
          <Button type="submit" variant="contained" disabled={saving}>
            {saving ? 'Zpracovávám…' : 'Potvrdit adopci'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}