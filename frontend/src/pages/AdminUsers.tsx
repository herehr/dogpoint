// frontend/src/pages/AdminUsers.tsx
// Admin: list all users with name, address, adoptions; edit name/address
import React, { useEffect, useMemo, useState } from 'react'
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
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import RefreshIcon from '@mui/icons-material/Refresh'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import { adminUsers, updateAdminUser, type AdminUser } from '../api'

function formatAddress(u: AdminUser): string {
  const parts = [
    [u.street, u.streetNo].filter(Boolean).join(' '),
    [u.zip, u.city].filter(Boolean).join(' '),
  ].filter(Boolean)
  return parts.join(', ') || '—'
}

function formatName(u: AdminUser): string {
  const first = (u.firstName ?? '').trim()
  const last = (u.lastName ?? '').trim()
  return [first, last].filter(Boolean).join(' ') || '—'
}

export default function AdminUsers() {
  const location = useLocation()
  const isModerator = location.pathname.startsWith('/moderator')
  const backTo = isModerator ? '/moderator' : '/admin'

  const [rows, setRows] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [editUser, setEditUser] = useState<AdminUser | null>(null)
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    street: '',
    streetNo: '',
    zip: '',
    city: '',
  })
  const [saving, setSaving] = useState(false)

  async function refresh() {
    setErr(null)
    setOk(null)
    setLoading(true)
    try {
      const list = await adminUsers()
      setRows(Array.isArray(list) ? list : [])
    } catch (e: any) {
      setErr(e?.message || 'Nepodařilo se načíst uživatele.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((u) => {
      const email = (u.email ?? '').toLowerCase()
      const name = formatName(u).toLowerCase()
      const addr = formatAddress(u).toLowerCase()
      const adoptions = u.adoptions.map((a) => (a.animalName ?? '').toLowerCase()).join(' ')
      return (
        email.includes(q) ||
        name.includes(q) ||
        addr.includes(q) ||
        adoptions.includes(q)
      )
    })
  }, [rows, search])

  function openEdit(u: AdminUser) {
    setEditUser(u)
    setEditForm({
      firstName: u.firstName ?? '',
      lastName: u.lastName ?? '',
      street: u.street ?? '',
      streetNo: u.streetNo ?? '',
      zip: u.zip ?? '',
      city: u.city ?? '',
    })
  }

  function closeEdit() {
    setEditUser(null)
    setSaving(false)
  }

  async function saveEdit() {
    if (!editUser) return
    setSaving(true)
    setErr(null)
    setOk(null)
    try {
      await updateAdminUser(editUser.id, {
        firstName: editForm.firstName.trim() || undefined,
        lastName: editForm.lastName.trim() || undefined,
        street: editForm.street.trim() || undefined,
        streetNo: editForm.streetNo.trim() || undefined,
        zip: editForm.zip.trim() || undefined,
        city: editForm.city.trim() || undefined,
      })
      setOk('Uloženo.')
      closeEdit()
      refresh()
    } catch (e: any) {
      setErr(e?.message || 'Uložení selhalo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 900, flex: 1 }}>
          Uživatelé – jména, adresy, adopce
        </Typography>
        <Button
          component={RouterLink}
          to={backTo}
          variant="outlined"
          size="small"
        >
          Zpět na přehled
        </Button>
        <Button
          variant="outlined"
          startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
          onClick={refresh}
          disabled={loading}
        >
          Obnovit
        </Button>
      </Stack>

      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
      {ok && <Alert severity="success" sx={{ mb: 2 }}>{ok}</Alert>}

      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'action.hover' }}>
              <TableCell colSpan={5} sx={{ py: 1.5, borderBottom: 'none' }}>
                <TextField
                  size="small"
                  placeholder="Hledat (e-mail, jméno, adresa, adopce)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  fullWidth
                  sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'background.paper' } }}
                />
              </TableCell>
            </TableRow>
            <TableRow sx={{ bgcolor: 'action.hover' }}>
              <TableCell sx={{ fontWeight: 700 }}>E-mail</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Jméno</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Adresa</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Adopce</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Upravit</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredRows.map((u) => (
              <TableRow key={u.id} hover>
                <TableCell>{u.email}</TableCell>
                <TableCell>{formatName(u)}</TableCell>
                <TableCell sx={{ maxWidth: 220 }}>{formatAddress(u)}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {u.adoptions.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">—</Typography>
                    ) : (
                      u.adoptions.map((a) => {
                        const isActive = (a.status || '').toUpperCase() === 'ACTIVE'
                        return (
                          <Chip
                            key={a.id}
                            label={a.animalName}
                            size="small"
                            variant="outlined"
                            sx={!isActive ? { bgcolor: 'grey.300', color: 'grey.600', borderColor: 'grey.400' } : undefined}
                          />
                        )
                      })
                    )}
                  </Stack>
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => openEdit(u)} title="Upravit">
                    <EditIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {/* Edit dialog */}
      <Dialog open={!!editUser} onClose={closeEdit} maxWidth="sm" fullWidth>
        <DialogTitle>Upravit uživatele – {editUser?.email}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Jméno"
              value={editForm.firstName}
              onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Příjmení"
              value={editForm.lastName}
              onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Ulice"
              value={editForm.street}
              onChange={(e) => setEditForm((f) => ({ ...f, street: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Číslo popisné"
              value={editForm.streetNo}
              onChange={(e) => setEditForm((f) => ({ ...f, streetNo: e.target.value }))}
              fullWidth
            />
            <TextField
              label="PSČ"
              value={editForm.zip}
              onChange={(e) => setEditForm((f) => ({ ...f, zip: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Město"
              value={editForm.city}
              onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEdit}>Zrušit</Button>
          <Button variant="contained" onClick={saveEdit} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : 'Uložit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}
