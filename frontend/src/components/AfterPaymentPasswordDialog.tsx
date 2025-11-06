// frontend/src/components/AfterPaymentPasswordDialog.tsx
import { useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Alert, Typography
} from '@mui/material'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

type Props = {
  open: boolean
  onClose: () => void
  animalId: string
  onLoggedIn?: (token: string) => void
}

export default function AfterPaymentPasswordDialog({ open, onClose, animalId, onLoggedIn }: Props) {
  const [email, setEmail] = useState<string>(() => {
    try {
      const raw = localStorage.getItem('dp:pendingUser')
      if (!raw) return ''
      const o = JSON.parse(raw)
      return o?.email || ''
    } catch { return '' }
  })
  const [name, setName] = useState<string>(() => {
    try {
      const raw = localStorage.getItem('dp:pendingUser')
      if (!raw) return ''
      const o = JSON.parse(raw)
      return o?.name || ''
    } catch { return '' }
  })
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const passOk = password.trim().length >= 6

  async function submit() {
    setErr(null)
    if (!emailOk || !passOk) return
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/api/auth/register-after-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json() as { token?: string }
      const token = data.token || ''
      try {
        sessionStorage.setItem('userToken', token)
        localStorage.setItem(`adopt:${animalId}`, '1') // unlock locally as well
        localStorage.removeItem('dp:pendingUser')
      } catch {}
      onLoggedIn?.(token)
      onClose()
    } catch (e: any) {
      setErr(e?.message || 'Registrace se nezdařila.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Vytvořte si heslo</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2 }}>
          Platba proběhla. Vytvořte si prosím heslo k vašemu účtu, abyste měli přístup k obsahu.
        </Typography>

        {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

        <TextField
          label="E-mail"
          fullWidth
          sx={{ mb: 2 }}
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <TextField
          label="Jméno (nepovinné)"
          fullWidth
          sx={{ mb: 2 }}
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <TextField
          label="Heslo (min. 6 znaků)"
          type="password"
          fullWidth
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Zavřít</Button>
        <Button onClick={submit} disabled={!emailOk || !passOk || saving} variant="contained">
          {saving ? 'Ukládám…' : 'Vytvořit účet'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}