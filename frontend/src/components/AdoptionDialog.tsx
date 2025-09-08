import React, { useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Stack
} from '@mui/material'
import { startAdoption } from '../services/api'

export default function AdoptionDialog({
  open,
  onClose,
  animalId,
  onGranted,
}: {
  open: boolean
  onClose: () => void
  animalId: string
  onGranted: () => void
}) {
  const [amount, setAmount] = useState<string>('300')
  const [email, setEmail] = useState<string>('')
  const [name, setName] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null); setLoading(true)
    try {
      // In MVP we ignore the amount/email/name on the backend and simply grant access.
      await startAdoption(animalId)
      onGranted()
      onClose()
    } catch (e: any) {
      setErr(e?.code === 401 ? 'Pro pokračování se přihlaste.' : (e?.message || 'Platba selhala'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Adopce – podpora zvířete</DialogTitle>
      <form onSubmit={submit}>
        <DialogContent>
          <Stack spacing={2}>
            <TextField
              label="Částka (Kč)"
              inputMode="numeric"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required
            />
            <TextField
              label="E-mail"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <TextField
              label="Jméno"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
            {err && <div style={{ color: 'crimson' }}>{err}</div>}
            <div style={{ fontSize: 12, color: '#777' }}>
              Platební brána bude brzy implementována. Nyní je to ukázka toku.
            </div>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Zrušit</Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? 'Zpracovávám…' : 'Pokračovat'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}