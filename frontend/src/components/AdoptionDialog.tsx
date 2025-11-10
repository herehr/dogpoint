// frontend/src/components/AdoptionDialog.tsx
import React, { useMemo, useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Stack, Typography, Button, TextField, Alert, Divider
} from '@mui/material'
import PaymentButtons from './payments/PaymentButtons'

type Props = {
  open: boolean
  onClose: () => void
  animalId: string
  defaultAmountCZK?: number
}

const PRESETS = [300, 500, 1000] as const

export default function AdoptionDialog({ open, onClose, animalId, defaultAmountCZK = 300 }: Props) {
  const [amount, setAmount] = useState<number>(defaultAmountCZK)
  const [email, setEmail] = useState<string>('')
  const [name, setName] = useState<string>('')

  const [custom, setCustom] = useState<string>('')

  const validEmail = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()), [email])
  const minOk = amount >= 50

  function pickPreset(v?: number) {
    if (!v) return
    setAmount(v)
    setCustom(String(v))
  }

  function handleCustomChange(v: string) {
    setCustom(v)
    const n = Number(v.replace(',', '.'))
    if (Number.isFinite(n)) setAmount(Math.round(n))
  }

  // (Optional) also stash lightweight context here (email/name/animalId) – harmless
  function persistPendingUserLite() {
    try {
      if (validEmail) {
        const payload = { email: email.trim(), name: name.trim(), animalId, ts: Date.now() }
        localStorage.setItem('dp:pendingUser', JSON.stringify(payload))
      }
    } catch {}
  }

  const disablePay = !minOk || !validEmail

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Adopce – měsíční podpora</DialogTitle>

      <DialogContent>
        {/* ČÁSTKA */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
            Výše měsíční podpory (Kč)
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap' }}>
            {PRESETS.map(p => (
              <Button key={p} variant={amount === p ? 'contained' : 'outlined'} onClick={() => pickPreset(p)}>
                {p} Kč
              </Button>
            ))}
            <Button variant={PRESETS.includes(amount as any) ? 'outlined' : 'contained'} onClick={() => {}}>
              Vlastní částka
            </Button>
          </Stack>
          <TextField
            fullWidth
            type="number"
            label="Částka (Kč) – měsíčně *"
            inputProps={{ min: 50, step: 10 }}
            value={custom || amount}
            onChange={e => handleCustomChange(e.target.value)}
            helperText="Minimální měsíční částka je 50 Kč"
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* E-MAIL + JMÉNO */}
        <Box sx={{ mb: 2 }}>
          <TextField
            label="E-mail **"
            fullWidth
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            sx={{ mb: 1.5 }}
          />
          <TextField
            label="Jméno"
            fullWidth
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Info */}
        <Alert severity="info" sx={{ mb: 2 }}>
          Platba kartou je zpracována přes Stripe. Po potvrzení budete přesměrováni na platební stránku.
        </Alert>

        {/* TLAČÍTKO PLATBY (Stripe) */}
        <PaymentButtons
          animalId={animalId}
          amountCZK={amount}
           email={user?.email ?? typedEmail}   // ← NOT undefined
           name={animal.jmeno || animal.name}
          disabled={disablePay}
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
          Jedná se o <b>měsíční</b> podporu (lze kdykoliv ukončit).
        </Typography>
      </DialogContent>

      <DialogActions>
        <Button onClick={() => { persistPendingUserLite(); onClose() }}>Zavřít</Button>
      </DialogActions>
    </Dialog>
  )
}