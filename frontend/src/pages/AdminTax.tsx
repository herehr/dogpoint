// frontend/src/pages/AdminTax.tsx
import React, { useState } from 'react'
import { Container, Typography, Paper, Stack, TextField, Button, Alert } from '@mui/material'
import RequestQuoteIcon from '@mui/icons-material/RequestQuote'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { sendTaxRequestByEmail } from '../api'

export default function AdminTax() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)

  async function onSend(e: React.FormEvent) {
    e.preventDefault()
    setErr(null); setOk(null); setLink(null); setExpiresAt(null)
    setLoading(true)

    try {
      const res = await sendTaxRequestByEmail(email)
      setOk(`E-mail odeslán na: ${res.sentTo}`)
      setLink(res.link)
      setExpiresAt(res.expiresAt)
      setEmail('')
    } catch (e: any) {
      setErr(e?.message || 'Nepodařilo se odeslat e-mail.')
    } finally {
      setLoading(false)
    }
  }

  async function copy(txt: string) {
    try {
      await navigator.clipboard.writeText(txt)
      setOk('Odkaz zkopírován do schránky.')
    } catch {
      setErr('Nepodařilo se zkopírovat odkaz.')
    }
  }

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Typography variant="h5" sx={{ fontWeight: 900, mb: 2 }}>
        Daňové údaje – odeslat žádost
      </Typography>

      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
      {ok && <Alert severity="success" sx={{ mb: 2 }}>{ok}</Alert>}

      <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
        <form onSubmit={onSend}>
          <Stack spacing={2}>
            <TextField
              label="E-mail uživatele"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
            />

            <Button
              type="submit"
              variant="contained"
              startIcon={<RequestQuoteIcon />}
              disabled={loading}
            >
              Odeslat e-mail s odkazem
            </Button>

            {link && (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="stretch">
                <TextField
                  label="Odkaz"
                  value={link}
                  fullWidth
                  InputProps={{ readOnly: true }}
                />
                <Button
                  variant="outlined"
                  startIcon={<ContentCopyIcon />}
                  onClick={() => copy(link)}
                >
                  Kopírovat
                </Button>
              </Stack>
            )}

            {expiresAt && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Platnost do: {new Date(expiresAt).toLocaleString()}
              </Typography>
            )}
          </Stack>
        </form>
      </Paper>
    </Container>
  )
}