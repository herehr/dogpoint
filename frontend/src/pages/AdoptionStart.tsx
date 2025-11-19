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
} from '@mui/material'
import { useParams, useSearchParams, useNavigate, Link as RouterLink } from 'react-router-dom'
import { createCheckoutSession, stashPendingEmail } from '../services/api'
import { useAuth } from '../context/AuthContext'

type PaymentMethod = 'card' | 'applepay' | 'googlepay'

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

  const amountCZK = React.useMemo(
    () => parseInt(search.get('amount') || '200', 10) || 200,
    [search],
  )

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) {
      setErr('Chybí ID zvířete.')
      return
    }
    if (!email) {
      setErr('Vyplňte prosím e-mail.')
      return
    }
    if (!firstName) {
      setErr('Vyplňte prosím jméno.')
      return
    }
    if (!password || password.length < 6) {
      setErr('Heslo musí mít alespoň 6 znaků.')
      return
    }
    setErr(null)
    setLoading(true)

    try {
      // TODO: in next backend step, also send password + paymentMethod
      // to create the user before Stripe.
      stashPendingEmail(email)

       const session = await createCheckoutSession({
        animalId: id,
        amountCZK,
        name: firstName,
        email,
        password, // ✅ now we send the password to backend
        // paymentMethod could be added to payload when backend is ready
      })

      if (!session || !session.url) {
        throw new Error('Server nevrátil odkaz na platbu.')
      }

      window.location.href = session.url
    } catch (e: any) {
      const msg = (e?.message || '').toString()
      setErr(msg || 'Nepodařilo se spustit platbu.')
      setLoading(false)
    }
  }

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ fontWeight: 900, mb: 2 }}>
        Adopce – údaje k platbě
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Vyplň prosím své údaje. Po úspěšné platbě ti vytvoříme účet, kde uvidíš všechny
        své adopce a odemčené příspěvky.
      </Typography>

      {err && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {err}
        </Alert>
      )}

      <Box component="form" onSubmit={onSubmit}>
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
        </RadioGroup>

        <Stack spacing={2}>
          <TextField
            label="E-mail"
            type="email"
            fullWidth
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Jméno"
            fullWidth
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <TextField
            label="Heslo pro účet"
            type="password"
            fullWidth
            required
            helperText="Minimálně 6 znaků. Po platbě se s tímto heslem přihlásíš."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Stack>

        <Typography variant="body2" sx={{ mt: 3, mb: 1 }}>
          Částka: <strong>{amountCZK} Kč / měsíc</strong>
        </Typography>

        <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
          >
            Pokračovat k platbě
          </Button>
          <Button
            variant="text"
            component={RouterLink}
            to={id ? `/zvire/${id}` : '/'}
          >
            Zpět na detail
          </Button>
        </Stack>
      </Box>
    </Container>
  )
}