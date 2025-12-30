// frontend/src/pages/AdminModerators.tsx
import React, { useEffect, useState } from 'react'
import {
  Container,
  Typography,
  Paper,
  Stack,
  TextField,
  Button,
  Alert,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import LockResetIcon from '@mui/icons-material/LockReset'
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1'
import MarkEmailUnreadIcon from '@mui/icons-material/MarkEmailUnread'
import RequestQuoteIcon from '@mui/icons-material/RequestQuote'
import {
  listModerators,
  createModerator,
  deleteModerator,
  resetModeratorPassword,
  apiUrl,
  sendTaxRequestByEmail,
} from '../api'

type ModRow = { id: string; email: string; role: string; active?: boolean }

export default function AdminModerators() {
  const [mods, setMods] = useState<ModRow[]>([])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [resetOpen, setResetOpen] = useState(false)
  const [resetId, setResetId] = useState<string | null>(null)
  const [resetPass, setResetPass] = useState('')

  // per-row loading (resend/tax)
  const [sendingInviteForId, setSendingInviteForId] = useState<string | null>(null)
  const [sendingTaxForId, setSendingTaxForId] = useState<string | null>(null)

  async function refresh() {
    setErr(null)
    try {
      const rows = await listModerators()
      setMods(rows)
    } catch (e: any) {
      setErr(e?.message || 'Chyba načítání moderátorů')
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setOk(null)
    setLoading(true)
    try {
      await createModerator(email.trim(), password)
      setOk('Moderátor vytvořen')
      setEmail('')
      setPassword('')
      await refresh()
    } catch (e: any) {
      setErr(e?.message || 'Vytvoření selhalo')
    } finally {
      setLoading(false)
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Opravdu odstranit tohoto moderátora?')) return
    setErr(null)
    setOk(null)
    try {
      await deleteModerator(id)
      setOk('Moderátor odstraněn')
      await refresh()
    } catch (e: any) {
      setErr(e?.message || 'Odstranění selhalo')
    }
  }

  function openReset(id: string) {
    setResetId(id)
    setResetPass('')
    setResetOpen(true)
  }

  async function onReset() {
    if (!resetId) return
    try {
      await resetModeratorPassword(resetId, resetPass)
      setOk('Heslo změněno')
      setResetOpen(false)
      setResetId(null)
      setResetPass('')
    } catch (e: any) {
      setErr(e?.message || 'Změna hesla selhala')
    }
  }

  /* ──────────────────────────────────────────────
     Resend invitation (admin)
     POST /api/admin/moderators/:id/resend-invite
  ────────────────────────────────────────────── */
  async function onResendInvite(id: string) {
    setErr(null)
    setOk(null)

    try {
      const token = sessionStorage.getItem('accessToken')
      if (!token || token === 'null' || token === 'undefined') {
        setErr('Nejste přihlášen jako admin.')
        return
      }

      setSendingInviteForId(id)

      const res = await fetch(
        apiUrl(`/api/admin/moderators/${encodeURIComponent(id)}/resend-invite`),
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        },
      )

      const txt = await res.text()
      if (!res.ok) throw new Error(`Odeslání pozvánky selhalo (${res.status}): ${txt}`)

      const data = txt ? JSON.parse(txt) : null
      const sentTo = data?.sentTo ? ` (${data.sentTo})` : ''
      setOk(`Pozvánka byla znovu odeslána${sentTo}.`)
    } catch (e: any) {
      setErr(e?.message || 'Nepodařilo se znovu poslat pozvánku.')
    } finally {
      setSendingInviteForId(null)
    }
  }

  /* ──────────────────────────────────────────────
     NEW: Ask for tax details (admin)
     POST /api/tax/send  body: { email }
  ────────────────────────────────────────────── */
  async function onAskTaxDetails(email: string, rowId: string) {
    setErr(null)
    setOk(null)
    try {
      setSendingTaxForId(rowId)

      const resp = await sendTaxRequestByEmail(email)
      setOk(`Žádost o daňové údaje byla odeslána (${resp.sentTo}).`)
    } catch (e: any) {
      setErr(e?.message || 'Nepodařilo se odeslat žádost o daňové údaje.')
    } finally {
      setSendingTaxForId(null)
    }
  }

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Typography variant="h5" sx={{ fontWeight: 900, mb: 2 }}>
        Moderátoři
      </Typography>

      {err && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {err}
        </Alert>
      )}
      {ok && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {ok}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
          Přidat moderátora
        </Typography>
        <form onSubmit={onCreate}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="E-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Heslo"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
            />
            <Button
              type="submit"
              variant="contained"
              startIcon={<PersonAddAlt1Icon />}
              disabled={loading}
              sx={{ alignSelf: { xs: 'stretch', sm: 'center' } }}
            >
              Přidat
            </Button>
          </Stack>
        </form>
      </Paper>

      <Paper variant="outlined" sx={{ p: 0, borderRadius: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>E-mail</TableCell>
              <TableCell>Role</TableCell>
              <TableCell align="right">Akce</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {mods.map((m) => (
              <TableRow key={m.id} hover>
                <TableCell>{m.email}</TableCell>
                <TableCell>{m.role}</TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    {/* NEW: ask for tax details */}
                    <IconButton
                      size="small"
                      onClick={() => onAskTaxDetails(m.email, m.id)}
                      title="Požádat o daňové údaje"
                      disabled={sendingTaxForId === m.id}
                    >
                      <RequestQuoteIcon fontSize="small" />
                    </IconButton>

                    {/* resend invite */}
                    <IconButton
                      size="small"
                      onClick={() => onResendInvite(m.id)}
                      title="Znovu poslat pozvánku"
                      disabled={sendingInviteForId === m.id}
                    >
                      <MarkEmailUnreadIcon fontSize="small" />
                    </IconButton>

                    <IconButton size="small" onClick={() => openReset(m.id)} title="Reset hesla">
                      <LockResetIcon fontSize="small" />
                    </IconButton>

                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => onDelete(m.id)}
                      title="Smazat"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}

            {mods.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  Žádní moderátoři
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={resetOpen} onClose={() => setResetOpen(false)}>
        <DialogTitle>Změna hesla moderátora</DialogTitle>
        <DialogContent>
          <TextField
            label="Nové heslo"
            type="password"
            value={resetPass}
            onChange={(e) => setResetPass(e.target.value)}
            fullWidth
            autoFocus
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetOpen(false)}>Zrušit</Button>
          <Button variant="contained" onClick={onReset} disabled={!resetPass}>
            Uložit
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}