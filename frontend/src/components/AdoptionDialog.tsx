import React, { useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Stack, Alert, Typography
} from '@mui/material'
import { createCheckoutSession } from '../services/api'

type Props = {
  open: boolean
  onClose: () => void
  animalId: string | undefined
  defaultEmail?: string
}

export default function AdoptionDialog({ open, onClose, animalId, defaultEmail }: Props) {
  const [email, setEmail] = useState(defaultEmail || '')
  const [amount, setAmount] = useState<number>(200)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const handleStart = async () => {
    if (!animalId) return
    setErr(null)
    setLoading(true)
    try {
      const { url } = await createCheckoutSession({
        animalId,
        amountCZK: amount,
        email: email || undefined,
        name: undefined,
      })
      // Redirect to Stripe
      window.location.href = url
    } catch (e: any) {
      setErr(e?.message || 'Nepodařilo se zahájit platbu.')
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Chci adoptovat</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Zadejte e-mail (pro zaslání potvrzení a vytvoření účtu) a částku měsíční podpory.
          </Typography>

          <TextField
            label="E-mail"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            fullWidth
            autoFocus
          />

          <TextField
            label="Měsíční částka (Kč)"
            type="number"
            inputProps={{ min: 100, step: 50 }}
            value={amount}
            onChange={e => setAmount(Number(e.target.value || 0))}
            fullWidth
          />

          {err && <Alert severity="error">{err}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Zavřít</Button>
        <Button variant="contained" onClick={handleStart} disabled={loading || !animalId}>
          Pokračovat k platbě
        </Button>
      </DialogActions>
    </Dialog>
  )
}