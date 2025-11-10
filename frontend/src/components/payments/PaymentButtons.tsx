// frontend/src/components/payments/PaymentButtons.tsx
import React, { useState } from 'react'
import { Button, Stack, TextField, Alert } from '@mui/material'
import { createCheckoutSession } from '../../services/api'

type Props = {
  animalId: string
  amountCZK: number
  email?: string
  name?: string
  disabled?: boolean
}

export default function PaymentButtons({ animalId, amountCZK, email, name, disabled }: Props) {
  const [localEmail, setLocalEmail] = useState(email || '')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function startStripe() {
    setErr(null)
    const e = (localEmail || '').trim()
    if (!e) { setErr('Zadejte e-mail.'); return }
    setBusy(true)
    try {
      // stash for after-payment prefill + auto-claim
      try {
        localStorage.setItem('dp:pendingEmail', e)
        localStorage.setItem('dp:pendingUser', JSON.stringify({ email: e }))
      } catch {}

      const { url } = await createCheckoutSession({
        animalId,
        amountCZK,
        email: e,
        name
      })
      // Go to Stripe Checkout
      window.location.href = url
    } catch (ex: any) {
      setErr(ex?.message || 'Nepodařilo se otevřít platbu.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Stack spacing={1.5}>
      {/* If you want the email BELOW a “card form”, you’d need Stripe Payment Element.
          With Checkout (redirect), we keep this email field here to pass it to Stripe. */}
      <TextField
        label="E-mail pro potvrzení"
        value={localEmail}
        onChange={e => setLocalEmail(e.target.value)}
        type="email"
        fullWidth
      />

      {err && <Alert severity="error">{err}</Alert>}

      <Button
        variant="contained"
        onClick={startStripe}
        disabled={busy || disabled}
      >
        Pokračovat k platbě
      </Button>
    </Stack>
  )
}