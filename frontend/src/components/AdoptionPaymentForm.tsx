import { useState } from 'react'
import {
  Box,
  Typography,
  TextField,
  RadioGroup,
  FormControlLabel,
  Radio,
  Button,
  Paper,
  Divider,
} from '@mui/material'

type PaymentMethod =
  | 'CARD'
  | 'APPLE_PAY'
  | 'GOOGLE_PAY'
  | 'BANK_TRANSFER'

export default function AdoptionPaymentForm() {
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>('CARD')

  const isOnlinePayment =
    paymentMethod === 'CARD' ||
    paymentMethod === 'APPLE_PAY' ||
    paymentMethod === 'GOOGLE_PAY'

  const isBankTransfer = paymentMethod === 'BANK_TRANSFER'

  return (
    <Box maxWidth={600} mx="auto">
      <Typography variant="h5" gutterBottom>
        Adopce – údaje k platbě
      </Typography>

      <Typography variant="body2" color="text.secondary" mb={3}>
        Vyplň prosím své údaje. Po úspěšné platbě ti vytvoříme účet,
        kde uvidíš všechny své adopce a odemčené příspěvky.
      </Typography>

      {/* USER DATA */}
      <TextField
        fullWidth
        required
        label="E-mail"
        margin="normal"
      />

      <TextField
        fullWidth
        required
        label="Jméno"
        margin="normal"
      />

      <TextField
        fullWidth
        required
        type="password"
        label="Heslo pro účet"
        helperText="Minimálně 6 znaků. Po platbě se s tímto heslem přihlásíš."
        margin="normal"
      />

      <Divider sx={{ my: 3 }} />

      {/* PAYMENT METHOD */}
      <Typography variant="subtitle1" gutterBottom>
        Způsob platby
      </Typography>

      <RadioGroup
        value={paymentMethod}
        onChange={(e) =>
          setPaymentMethod(e.target.value as PaymentMethod)
        }
      >
        <FormControlLabel
          value="CARD"
          control={<Radio />}
          label="Platební karta"
        />
        <FormControlLabel
          value="APPLE_PAY"
          control={<Radio />}
          label="Apple Pay"
        />
        <FormControlLabel
          value="GOOGLE_PAY"
          control={<Radio />}
          label="Google Pay"
        />
        <FormControlLabel
          value="BANK_TRANSFER"
          control={<Radio />}
          label="Internetbanking (převod)"
        />
      </RadioGroup>

      <Divider sx={{ my: 3 }} />

      {/* AMOUNT */}
      <Typography variant="subtitle1" mb={2}>
        Částka: <strong>200 Kč / měsíc</strong>
      </Typography>

      {/* ✅ ONLINE PAYMENT BUTTON FIRST */}
      {isOnlinePayment && (
        <Button
          fullWidth
          size="large"
          variant="contained"
          color="primary"
          sx={{ py: 1.5, mb: 3 }}
          onClick={() => {
            // TODO: Stripe checkout redirect
          }}
        >
          Zaplatit online
        </Button>
      )}

      {/* ✅ BANK TRANSFER DETAILS ONLY IF SELECTED */}
      {isBankTransfer && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Pokyny pro bankovní převod
          </Typography>

          <Typography variant="body2" mb={2}>
            Pro aktivaci adopce prosím nastav trvalý příkaz (měsíčně).
            Nejrychlejší je naskenovat QR kód v bankovní aplikaci.
          </Typography>

          <Typography variant="body2">
            <strong>Příjemce:</strong> Dogpoint o.p.s.
            <br />
            <strong>IBAN:</strong> CZ6508000000001234567899
            <br />
            <strong>Částka:</strong> 200 Kč
            <br />
            <strong>Variabilní symbol (VS):</strong> 5951443495
          </Typography>

          <Divider sx={{ my: 2 }} />

          <Typography variant="caption" display="block">
            SPAYD
          </Typography>

          <Typography
            variant="caption"
            sx={{ wordBreak: 'break-all' }}
          >
            SPD*1.0*ACC:CZ6508000000001234567899*AM:200.00*CC:CZK*X-VS:5951443495*MSG:Dogpoint adopce cmg67rgjr00068j0dmrs9t74n
          </Typography>

          {/* QR placeholder */}
          <Box
            mt={2}
            sx={{
              width: 160,
              height: 160,
              bgcolor: '#f5f5f5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              color: 'text.secondary',
            }}
          >
            QR SPAYD
          </Box>

          <Typography variant="body2" mt={2}>
            Tip: Po zaplacení převodem se adopce spáruje automaticky
            (import z Fio).
          </Typography>
        </Paper>
      )}
    </Box>
  )
}