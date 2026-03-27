// frontend/src/components/ShareInviteDialog.tsx
import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Typography,
  Alert,
  MenuItem,
} from '@mui/material'
import { createShareInvite, SHARE_INVITE_REASON_PRESETS } from '../services/api'
import FaqLink from './FaqLink'

type Props = {
  open: boolean
  onClose: () => void
  subscriptionId: string
  animalName: string
  onSent?: () => void
}

const MAX_MSG = 300

export default function ShareInviteDialog({
  open,
  onClose,
  subscriptionId,
  animalName,
  onSent,
}: Props) {
  const [email, setEmail] = React.useState('')
  const [message, setMessage] = React.useState('')
  const [reason, setReason] = React.useState('')
  const [reasonCustom, setReasonCustom] = React.useState('')
  const [err, setErr] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [done, setDone] = React.useState(false)

  React.useEffect(() => {
    if (!open) {
      setEmail('')
      setMessage('')
      setReason('')
      setReasonCustom('')
      setErr(null)
      setDone(false)
    }
  }, [open])

  const reasonFinal =
    reason === '__custom__' ? reasonCustom.trim().slice(0, 200) : reason || undefined

  const handleSend = async () => {
    setErr(null)
    if (!email.trim()) {
      setErr('Vyplňte e-mail příjemce.')
      return
    }
    setLoading(true)
    try {
      await createShareInvite({
        subscriptionId,
        recipientEmail: email.trim(),
        message: message.trim() || undefined,
        reason: reasonFinal,
      })
      setDone(true)
      onSent?.()
    } catch (e: any) {
      setErr(e?.message || 'Odeslání se nezdařilo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Sdílet se známým – {animalName}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Příjemce dostane e-mail s odkazem. Po přijetí uvidí příspěvky zvířete (bez možnosti platit). Platnost
          pozvánky je 7 dní.
        </Typography>
        {done ? (
          <Alert severity="success">Pozvánka byla odeslána.</Alert>
        ) : (
          <Stack spacing={2}>
            {err && (
              <Alert severity="error" onClose={() => setErr(null)}>
                {err}
              </Alert>
            )}
            <TextField
              label="E-mail příjemce"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              required
              size="small"
            />
            <TextField
              label="Důvod / poznámka (volitelné)"
              select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              fullWidth
              size="small"
              SelectProps={{ displayEmpty: true }}
            >
              <MenuItem value="">
                <em>— vyberte nebo nechte prázdné —</em>
              </MenuItem>
              {SHARE_INVITE_REASON_PRESETS.map((r) => (
                <MenuItem key={r} value={r}>
                  {r}
                </MenuItem>
              ))}
              <MenuItem value="__custom__">Vlastní text…</MenuItem>
            </TextField>
            {reason === '__custom__' && (
              <TextField
                label="Vlastní důvod"
                value={reasonCustom}
                onChange={(e) => setReasonCustom(e.target.value)}
                fullWidth
                size="small"
                inputProps={{ maxLength: 200 }}
              />
            )}
            <TextField
              label="Osobní zpráva (volitelné)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              fullWidth
              multiline
              minRows={2}
              inputProps={{ maxLength: MAX_MSG }}
              helperText={`${message.length}/${MAX_MSG}`}
              size="small"
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              Pravidla pozvánek (počet, platnost): <FaqLink sx={{ fontSize: 'inherit' }} />
            </Typography>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{done ? 'Zavřít' : 'Zrušit'}</Button>
        {!done && (
          <Button variant="contained" onClick={handleSend} disabled={loading}>
            {loading ? 'Odesílám…' : 'Odeslat pozvánku'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
