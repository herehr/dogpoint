// frontend/src/pages/AdminModerators.tsx
import React, { useEffect, useState } from 'react'
import {
  Container, Typography, Paper, Stack, TextField, Button, Alert,
  Table, TableHead, TableRow, TableCell, TableBody, IconButton, Dialog,
  DialogTitle, DialogContent, DialogActions
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import LockResetIcon from '@mui/icons-material/LockReset'
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1'
import {
  listModerators, createModerator, deleteModerator, resetModeratorPassword
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

  async function refresh() {
    setErr(null)
    try {
      const rows = await listModerators()
      setMods(rows)
    } catch (e: any) {
      setErr(e?.message || 'Chyba načítání moderátorů')
    }
  }

  useEffect(() => { refresh() }, [])

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    setErr(null); setOk(null); setLoading(true)
    try {
      await createModerator(email.trim(), password)
      setOk('Moderátor vytvořen')
      setEmail(''); setPassword('')
      await refresh()
    } catch (e: any) {
      setErr(e?.message || 'Vytvoření selhalo')
    } finally { setLoading(false) }
  }

  async function onDelete(id: string) {
    if (!confirm('Opravdu odstranit tohoto moderátora?')) return
    setErr(null); setOk(null)
    try {
      await deleteModerator(id)
      setOk('Moderátor odstraněn')
      await refresh()
    } catch (e: any) {
      setErr(e?.message || 'Odstranění selhalo')
    }
  }

  function openReset(id: string) {
    setResetId(id); setResetPass(''); setResetOpen(true)
  }

  async function onReset() {
    if (!resetId) return
    try {
      await resetModeratorPassword(resetId, resetPass)
      setOk('Heslo změněno'); setResetOpen(false); setResetId(null); setResetPass('')
    } catch (e: any) {
      setErr(e?.message || 'Změna hesla selhala')
    }
  }

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Typography variant="h5" sx={{ fontWeight: 900, mb: 2 }}>
        Moderátoři
      </Typography>

      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
      {ok && <Alert severity="success" sx={{ mb: 2 }}>{ok}</Alert>}

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
            {mods.map(m => (
              <TableRow key={m.id} hover>
                <TableCell>{m.email}</TableCell>
                <TableCell>{m.role}</TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <IconButton size="small" onClick={() => openReset(m.id)} title="Reset hesla">
                      <LockResetIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => onDelete(m.id)} title="Smazat">
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
          <Button variant="contained" onClick={onReset} disabled={!resetPass}>Uložit</Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}