import React, { useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Stack, Alert
} from '@mui/material'
import { useAccess } from '../context/AccessContext'

// Simple helper using the same BASE as api.ts without importing the whole module
const RAW: string = (import.meta as any).env?.VITE_API_BASE_URL || ''
const BASE_URL: string = RAW.replace(/\/+$/, '')

function setToken(t: string) {
  if (typeof window !== 'undefined') sessionStorage.setItem('accessToken', t)
}

type Props = {
  open: boolean
  onClose: () => void
  animalId: string
  onGranted: () => void
}

export default function AdoptionDialog({ open, onClose, animalId, onGranted }: Props) {
  const { grantAccess } = useAccess()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [monthly, setMonthly] = useState(300)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setSaving(true)
    try {
      const res = await fetch(BASE_URL + '/api/adoption/mock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ animalId, email: email.trim(), name: name.trim(), monthly })
      })
      if (!res.ok) {
        let t = ''
        try { t = await res.text() } catch {}
        throw new Error('Adoption failed: ' + res.status + (t ? ' → ' + t : ''))
      }
      const data = await res.json()
      if (data?.token) setToken(data.token)
      // unlock locally
      grantAccess(animalId)
      onGranted()
      onClose()
    } catch (e: any) {
      setErr(e?.message || 'Adoption failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Adopce (DEV) – okamžité odemčení</DialogTitle>
      <form onSubmit={onSubmit}>
        <DialogContent>
          <Stack spacing={2}>
            {err && <Alert severity="error">{err}</Alert>}
            <TextField
              label="E-mail"
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
            <TextField
              label="Měsíční částka (CZK)"
              type="number"
              value={monthly}
              onChange={(e) => setMonthly(Number(e.target.value) || 0)}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Zrušit</Button>
          <Button type="submit" variant="contained" disabled={saving}>
            {saving ? 'Zpracovávám…' : 'Dokončit adopci (DEV)'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}