// frontend/src/pages/AdoptionStart.tsx
import React from 'react'
import {
  Container,
  Typography,
  Box,
  TextField,
  RadioGroup,
  FormControlLabel,
  Radio,
  Button,
  Stack,
  Alert,
  Paper,
  Divider,
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import IconButton from '@mui/material/IconButton'
import { useParams, useSearchParams, useNavigate, Link as RouterLink } from 'react-router-dom'
import QRCode from 'qrcode'
import {
  createCheckoutSession,
  stashPendingEmail,
  startBankAdoption, // ✅ 2-step flow (step 1)
  sendBankPaymentEmail, // ✅ 2-step flow (step 2: send details)
  startBankAdoptionAndSendPdf, // (kept; legacy)
  setToken,
} from '../services/api'
import { useAuth } from '../context/AuthContext'

type PaymentMethod = 'card' | 'applepay' | 'googlepay' | 'bank'

function generateVS(): string {
  const rnd = Math.floor(Math.random() * 10_000_000)
  return `595${String(rnd).padStart(7, '0')}`
}

function moneyCZK(amountCZK: number): string {
  return `${amountCZK.toFixed(2)}`
}

/**
 * SPAYD format (CZ):
 * SPD*1.0*ACC:<IBAN>*AM:<amount>*CC:CZK*X-VS:<vs>*MSG:<message>
 */
function buildSpayd(params: { iban: string; amountCZK: number; vs: string; message?: string }): string {
  const iban = (params.iban || '').replace(/\s+/g, '').toUpperCase()
  const parts: string[] = [
    'SPD*1.0',
    `ACC:${iban}`,
    `AM:${moneyCZK(params.amountCZK)}`,
    'CC:CZK',
    `X-VS:${params.vs}`,
  ]

  const msg = (params.message || '').trim()
  if (msg) {
    const safe = msg.replace(/\*/g, ' ').slice(0, 60)
    parts.push(`MSG:${safe}`)
  }

  return parts.join('*')
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
}

export default function AdoptionStart() {
  const { id } = useParams<{ id: string }>()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>('card')
  const [email, setEmail] = React.useState(user?.email || '')
  const [firstName, setFirstName] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  // allow "amount" like "200", "200.00", "200,00"
  const amountCZK = React.useMemo(() => {
    const raw = (search.get('amount') || '200').trim()
    const normalized = raw.replace(',', '.')
    const n = Number(normalized)
    if (!Number.isFinite(n) || n <= 0) return 200
    return Math.round(n)
  }, [search])

  // -------------------------
  // BANK FLOW (2-step)
  // -------------------------
  const [bankVS, setBankVS] = React.useState<string>(() => generateVS())
  const [qrDataUrl, setQrDataUrl] = React.useState<string>('')
  const [bankStarted, setBankStarted] = React.useState(false)
  const [bankBusy, setBankBusy] = React.useState(false)
  const [bankEmailSent, setBankEmailSent] = React.useState(false)

  const bankIban = (import.meta as any).env?.VITE_BANK_IBAN as string | undefined
  const bankName = (import.meta as any).env?.VITE_BANK_NAME as string | undefined

  const bankMessage = React.useMemo(() => `Dogpoint adopce ${id || ''}`.trim(), [id])

  const spayd = React.useMemo(() => {
    if (!bankIban) return ''
    return buildSpayd({
      iban: bankIban,
      amountCZK,
      vs: bankVS,
      message: bankMessage,
    })
  }, [bankIban, amountCZK, bankVS, bankMessage])

  // ✅ keep email in sync if user loads later (but never overwrite manual edits)
  React.useEffect(() => {
    if (user?.email && !email) setEmail(user.email)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email])

  // ✅ generate QR only when bankStarted
  React.useEffect(() => {
    let cancelled = false

    async function run() {
      if (paymentMethod !== 'bank') return
      if (!bankStarted) return
      if (!spayd) return

      try {
        const url = await QRCode.toDataURL(spayd, { errorCorrectionLevel: 'M', margin: 1, scale: 6 })
        if (!cancelled) setQrDataUrl(url)
      } catch {
        if (!cancelled) setQrDataUrl('')
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [paymentMethod, bankStarted, spayd])

  // ✅ when switching payment method, reset bank state (but keep VS unless you want a new one)
  React.useEffect(() => {
    setErr(null)
    setLoading(false)
    setBankBusy(false)

    if (paymentMethod !== 'bank') {
      setBankStarted(false)
      setBankEmailSent(false)
      setQrDataUrl('')
    } else {
      setBankVS((prev) => prev || generateVS())
    }
  }, [paymentMethod])

  function validateInputs(): string | null {
    if (!id) return 'Chybí ID zvířete.'
    if (!email) return 'Vyplňte prosím e-mail.'
    if (!firstName) return 'Vyplňte prosím jméno.'
    if (!password || password.length < 6) return 'Heslo musí mít alespoň 6 znaků.'
    return null
  }

  const validationError = validateInputs()
  const showBank = paymentMethod === 'bank'
  const showBankInstructions = showBank && bankStarted

  // ✅ disable main CTA until valid (and also avoid double-click)
  const mainDisabled =
    loading ||
    Boolean(validationError) ||
    (showBank && bankStarted) // bank step1 already done -> hide main CTA
  const inputsDisabled = loading || bankStarted

  // ✅ Unified “CHCI ZAPLATIT” action
  const onPay = async () => {
    const v = validateInputs()
    if (v) {
      setErr(v)
      return
    }
    if (!id) return

    setErr(null)
    setLoading(true)

    try {
      stashPendingEmail(email)

      if (paymentMethod === 'bank') {
        // STEP 1: start bank adoption (NO email here)
        const resp = await startBankAdoption({
          animalId: id,
          amountCZK,
          name: firstName,
          email,
          password,
          vs: bankVS,
        })

        if ((resp as any)?.token) setToken((resp as any).token)

        setBankStarted(true)
        setBankEmailSent(false)
        return
      }

      // Stripe (card / apple / google)
      const session = await createCheckoutSession({
        animalId: id,
        amountCZK,
        name: firstName,
        email,
        password,
      })

      if (!session || !session.url) throw new Error('Server nevrátil odkaz na platbu.')
      window.location.href = session.url
    } catch (e: any) {
      const msg = (e?.response?.data?.error || e?.message || '').toString()
      setErr(msg || 'Nepodařilo se spustit platbu.')
    } finally {
      setLoading(false)
    }
  }

  // ✅ STEP 2a: user confirms they paid (UI action)
  const onIHavePaid = () => {
    if (!id) return
    navigate(`/zvire/${id}?bank=paid`)
  }

  // ✅ STEP 2b: send details by email (PDF)
  const onSendEmail = async () => {
    const v = validateInputs()
    if (v) {
      setErr(v)
      return
    }
    if (!id) return

    setErr(null)
    setBankBusy(true)
    try {
      const resp = await sendBankPaymentEmail({
        animalId: id,
        amountCZK,
        name: firstName,
        email,
        password,
        vs: bankVS,
      })

      if ((resp as any)?.token) setToken((resp as any).token)
      setBankEmailSent(true)

      // keep user on the page so they see “sent” state; you can still navigate if you prefer
      // navigate(`/zvire/${id}?bank=email`)
    } catch (e: any) {
      const msg = (e?.response?.data?.error || e?.message || '').toString()
      setErr(msg || 'Nepodařilo se odeslat e-mail.')
    } finally {
      setBankBusy(false)
    }
  }

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ fontWeight: 900, mb: 2 }}>
        Adopce – údaje k platbě
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Vyplň prosím své údaje. Po úspěšné platbě ti vytvoříme účet, kde uvidíš všechny své adopce a odemčené
        příspěvky.
      </Typography>

      {err && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {err}
        </Alert>
      )}

      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
        Způsob platby
      </Typography>

      <RadioGroup
        row
        value={paymentMethod}
        onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
        sx={{ mb: 3 }}
      >
        <FormControlLabel value="card" control={<Radio />} label="Platební karta" />
        <FormControlLabel value="applepay" control={<Radio />} label="Apple Pay" />
        <FormControlLabel value="googlepay" control={<Radio />} label="Google Pay" />
        <FormControlLabel value="bank" control={<Radio />} label="Internetbanking (převod)" />
      </RadioGroup>

      <Stack spacing={2}>
        <TextField
          label="E-mail"
          type="email"
          fullWidth
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={inputsDisabled}
        />
        <TextField
          label="Jméno"
          fullWidth
          required
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          disabled={inputsDisabled}
        />
        <TextField
          label="Heslo pro účet"
          type="password"
          fullWidth
          required
          helperText="Minimálně 6 znaků. Po platbě se s tímto heslem přihlásíš."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={inputsDisabled}
        />
      </Stack>

      <Typography variant="body2" sx={{ mt: 3, mb: 1 }}>
        Částka: <strong>{amountCZK} Kč / měsíc</strong>
      </Typography>

      {/* ✅ Primary CTA (disabled until valid) */}
      <Stack spacing={2} sx={{ mt: 2 }}>
        <Button variant="contained" disabled={mainDisabled} onClick={onPay}>
          {loading ? 'Zpracovávám…' : 'CHCI ZAPLATIT'}
        </Button>

        <Button variant="text" component={RouterLink} to={id ? `/zvire/${id}` : '/'}>
          Zpět na detail
        </Button>
      </Stack>

      {/* ✅ Bank instructions only after Step 1 */}
      {showBankInstructions && (
        <Paper variant="outlined" sx={{ mt: 3, p: 2, borderRadius: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
            Pokyny pro bankovní převod
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Pro aktivaci adopce prosím nastav <strong>trvalý příkaz</strong> (měsíčně). Nejrychlejší je
            naskenovat QR kód v bankovní aplikaci.
          </Typography>

          {!bankIban && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Chybí <code>VITE_BANK_IBAN</code>. Přidej IBAN do env (Vite) pro QR/SPAYD.
            </Alert>
          )}

          <Stack spacing={1.2}>
            <Typography variant="body2">
              <strong>Příjemce:</strong> {bankName || 'Dogpoint o.p.s.'}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ pr: 1, wordBreak: 'break-all' }}>
                <strong>IBAN:</strong> {bankIban || '—'}
              </Typography>
              {bankIban && (
                <IconButton size="small" onClick={() => copyToClipboard(bankIban)} aria-label="copy iban">
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              )}
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="body2">
                <strong>Částka:</strong> {amountCZK} Kč
              </Typography>
              <IconButton size="small" onClick={() => copyToClipboard(String(amountCZK))} aria-label="copy amount">
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="body2">
                <strong>Variabilní symbol (VS):</strong> {bankVS}
              </Typography>
              <IconButton size="small" onClick={() => copyToClipboard(bankVS)} aria-label="copy vs">
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Box>

            <Divider sx={{ my: 1 }} />

            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              SPAYD
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ pr: 1, wordBreak: 'break-all' }}>
                {spayd || '—'}
              </Typography>
              {spayd && (
                <IconButton size="small" onClick={() => copyToClipboard(spayd)} aria-label="copy spayd">
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              )}
            </Box>

            {qrDataUrl && (
              <Box sx={{ mt: 1, display: 'flex', justifyContent: 'center' }}>
                <Box
                  component="img"
                  src={qrDataUrl}
                  alt="QR SPAYD"
                  sx={{ width: 220, height: 220, borderRadius: 2 }}
                />
              </Box>
            )}
          </Stack>

          <Alert severity="info" sx={{ mt: 2 }}>
            Tip: Po zaplacení převodem se adopce spáruje automaticky (import z Fio).
          </Alert>

          {/* exactly 2 buttons */}
          <Stack spacing={1.5} sx={{ mt: 2 }}>
            <Button variant="contained" onClick={onIHavePaid}>
              Zaplatil jsem
            </Button>

            <Button variant="outlined" disabled={bankBusy || bankEmailSent} onClick={onSendEmail}>
              {bankEmailSent ? 'E-mail odeslán ✅' : bankBusy ? 'Odesílám…' : 'Pošlete mi údaje e-mailem'}
            </Button>
          </Stack>
        </Paper>
      )}
    </Container>
  )
}