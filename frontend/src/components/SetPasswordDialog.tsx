import React, { useState } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Stack, Alert } from '@mui/material'
import { setPasswordFirstTime } from '../services/api'

type Props = {
  open: boolean
  email: string
  onClose: () => void
  onSuccess?: () => void
}

export default function SetPasswordDialog({ open, email, onClose, onSuccess }: Props) {
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!p1 || p1.length < 6) { setErr('Heslo musí mít alespoň 6 znaků.'); return }
    if (p1 !== p2) { setErr('Hesla se neshodují.'); return }
    setSaving(true)
    try {
      await setPasswordFirstTime(email, p1)
      onSuccess?.()
      onClose()
    } catch (e: any) {
      setErr(e?.message || 'Nelze nastavit heslo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Nastavit heslo</DialogTitle>
      <form onSubmit={submit}>
        <DialogContent>
          <Stack spacing={2}>
            {err && <Alert severity="error">{err}</Alert>}
            <TextField label="E-mail" value={email} disabled fullWidth />
            <TextField label="Heslo" type="password" value={p1} onChange={e => setP1(e.target.value)} required fullWidth />
            <TextField label="Heslo znovu" type="password" value={p2} onChange={e => setP2(e.target.value)} required fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Zavřít</Button>
          <Button type="submit" variant="contained" disabled={saving}>{saving ? 'Ukládám…' : 'Uložit'}</Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}