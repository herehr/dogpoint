// frontend/src/components/AdoptionDialog.tsx
import React, { useEffect, useRef, useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Stack, Alert, Typography, Chip, Box, Divider, ToggleButtonGroup, ToggleButton, Paper
} from '@mui/material'
import { startAdoption, getAdoptionMe } from '../api'
import SetPasswordDialog from './SetPasswordDialog'
import { useAccess } from '../context/AccessContext'

type Props = {
  open: boolean
  onClose: () => void
  animalId: string
  onGranted: () => void
}

type PaymentMethod = 'CARD' | 'BANK'

export default function AdoptionDialog({ open, onClose, animalId, onGranted }: Props) {
  const { hasAccess, grantAccess } = useAccess()

  // form state
  const [monthly, setMonthly] = useState<number>(300)
  const amountInputRef = useRef<HTMLInputElement>(null)

  const [email, setEmail] = useState<string>('')
  const [name, setName] = useState<string>('')

  const [method, setMethod] = useState<PaymentMethod>('CARD')

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
      // Backend demo unlock (same call as before).
      // Later you can split by method: e.g. create Stripe Checkout for CARD,
      // return bank VS/instructions for BANK.
      const data = await startAdoption(
        animalId,
        knownEmail ?? email.trim(),
        name.trim() || 'Adoptující',
        m
      )

      // If backend provides a Stripe checkout URL (future), go there immediately.
      if (method === 'CARD' && data && (data as any).checkoutUrl) {
        window.location.assign((data as any).checkoutUrl as string)
        return
      }

      // Local unlock & close (demo path)
      grantAccess(animalId)
      setOk('Adopce potvrzena (DEMO). Obsah byl odemčen.')
      onGranted()

      // For BANK we keep the dialog open briefly to show instructions (below).
      if (method === 'CARD') {
        onClose()
      }

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

                {/* Amount input */}
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

                <Divider sx={{ my: 1 }} />

                {/* Payment method selector */}
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                  Jak chcete platit?
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  value={method}
                  onChange={(_, val: PaymentMethod | null) => { if (val) setMethod(val) }}
                  fullWidth
                  size="small"
                >
                  <ToggleButton value="CARD">Kreditní / debetní karta</ToggleButton>
                  <ToggleButton value="BANK">Bankovní převod</ToggleButton>
                </ToggleButtonGroup>

                {/* Helper blocks per method (informational only for now) */}
                {method === 'CARD' && (
                  <Alert severity="info">
                    Platba kartou je zpracována přes Stripe. Po potvrzení budete přesměrováni na platební stránku.
                  </Alert>
                )}
                {method === 'BANK' && (
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>
                      Instrukce k bankovnímu převodu
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Přispívejte měsíčně trvalým příkazem:
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="body2"><b>Účet (Fio):</b> 1234567890 / 2010</Typography>
                      <Typography variant="body2"><b>Variabilní symbol:</b> bude zaslán e-mailem po potvrzení</Typography>
                      <Typography variant="body2"><b>Zpráva pro příjemce:</b> Adopce – {name || 'Podpora'}</Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                      Po přijetí platby vám automaticky odemkneme obsah.
                    </Typography>
                  </Paper>
                )}

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
                  Jedná se o <b>měsíční</b> podporu (lze kdykoli ukončit).
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
                {saving
                  ? 'Zpracovávám…'
                  : method === 'CARD'
                  ? 'Pokračovat na platbu kartou'
                  : 'Potvrdit a zobrazit instrukce'
                }
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