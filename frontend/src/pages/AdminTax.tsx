// frontend/src/pages/AdminTax.tsx
import React, { useEffect, useMemo, useState } from 'react'
import {
  Container,
  Typography,
  Paper,
  Stack,
  TextField,
  Button,
  Alert,
  Checkbox,
  FormControlLabel,
  Divider,
  Chip,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Tooltip,
  CircularProgress,
  Autocomplete,
} from '@mui/material'
import RequestQuoteIcon from '@mui/icons-material/RequestQuote'
import MarkEmailUnreadIcon from '@mui/icons-material/MarkEmailUnread'
import SelectAllIcon from '@mui/icons-material/SelectAll'
import ClearIcon from '@mui/icons-material/Clear'
import RefreshIcon from '@mui/icons-material/Refresh'
import {
  adminTaxUsers,
  sendTaxBatch,
  sendTaxRequestByEmail,
  type AdminTaxUser,
} from '../api'

type Mode = 'missing' | 'complete' | 'all'

function isAddressComplete(u: AdminTaxUser): boolean {
  // Prefer backend hint when present
  if (typeof u.hasTaxProfile === 'boolean') return u.hasTaxProfile

  // Fallback: check user fields (admin endpoint may include these)
  const ok =
    !!(u.firstName && u.firstName.trim()) &&
    !!(u.lastName && u.lastName.trim()) &&
    !!(u.street && u.street.trim()) &&
    !!(u.streetNo && String(u.streetNo).trim()) &&
    !!(u.zip && String(u.zip).trim()) &&
    !!(u.city && u.city.trim())
  return ok
}

export default function AdminTax() {
  const [rows, setRows] = useState<AdminTaxUser[]>([])
  const [loading, setLoading] = useState(false)

  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const [mode, setMode] = useState<Mode>('missing')
  const [q, setQ] = useState('')

  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [sending, setSending] = useState(false)

  // Optional: keep your old single-email sender (handy for one-off)
  const [singleEmail, setSingleEmail] = useState('')
  const [singleLoading, setSingleLoading] = useState(false)
  const [singleLink, setSingleLink] = useState<string | null>(null)
  const [singleExpiresAt, setSingleExpiresAt] = useState<string | null>(null)

  async function refresh() {
    setErr(null)
    setOk(null)
    setLoading(true)
    try {
      const list = await adminTaxUsers()
      setRows(Array.isArray(list) ? list : [])
      setSelected({})
    } catch (e: any) {
      setErr(e?.message || 'Nepodařilo se načíst seznam uživatelů.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()

    return rows
      .map((u) => ({
        ...u,
        __complete: isAddressComplete(u),
      }))
      .filter((u) => {
        if (mode === 'missing' && u.__complete) return false
        if (mode === 'complete' && !u.__complete) return false
        if (!s) return true
        return (
          u.email.toLowerCase().includes(s) ||
          (u.firstName ?? '').toLowerCase().includes(s) ||
          (u.lastName ?? '').toLowerCase().includes(s) ||
          (u.city ?? '').toLowerCase().includes(s)
        )
      })
  }, [rows, mode, q])

  const filteredIds = useMemo(() => filtered.map((u) => u.id), [filtered])
  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected],
  )

  const allFilteredSelected = useMemo(() => {
    if (filteredIds.length === 0) return false
    return filteredIds.every((id) => !!selected[id])
  }, [filteredIds, selected])

  const selectedCount = selectedIds.length

  function toggle(id: string, v: boolean) {
    setSelected((prev) => ({ ...prev, [id]: v }))
  }

  function selectAllFiltered() {
    setSelected((prev) => {
      const next = { ...prev }
      for (const id of filteredIds) next[id] = true
      return next
    })
  }

  function clearAll() {
    setSelected({})
  }

  function clearFiltered() {
    setSelected((prev) => {
      const next = { ...prev }
      for (const id of filteredIds) delete next[id]
      return next
    })
  }

  async function sendMissing() {
    setErr(null)
    setOk(null)
    if (selectedIds.length === 0) {
      setErr('Nejprve vyberte alespoň jednoho uživatele.')
      return
    }

    setSending(true)
    try {
      // “Ask for details” => recheck=false
      const res = await sendTaxBatch({ userIds: selectedIds, recheck: false })
      const okCount = res?.results?.filter((r) => r.ok).length ?? 0
      const failCount = res?.results?.filter((r) => !r.ok).length ?? 0
      setOk(`Odesláno: ${okCount}, selhalo: ${failCount}.`)
      await refresh()
    } catch (e: any) {
      setErr(e?.message || 'Odeslání selhalo.')
    } finally {
      setSending(false)
    }
  }

  async function sendRecheck() {
    setErr(null)
    setOk(null)
    if (selectedIds.length === 0) {
      setErr('Nejprve vyberte alespoň jednoho uživatele.')
      return
    }

    setSending(true)
    try {
      // “Already OK” => recheck=true (backend can send slightly different email wording)
      const res = await sendTaxBatch({ userIds: selectedIds, recheck: true })
      const okCount = res?.results?.filter((r) => r.ok).length ?? 0
      const failCount = res?.results?.filter((r) => !r.ok).length ?? 0
      setOk(`Re-check e-maily odeslány: ${okCount}, selhalo: ${failCount}.`)
      await refresh()
    } catch (e: any) {
      setErr(e?.message || 'Odeslání selhalo.')
    } finally {
      setSending(false)
    }
  }

  async function onSendSingle(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setOk(null)
    setSingleLink(null)
    setSingleExpiresAt(null)

    const clean = singleEmail.trim()
    if (!clean) return

    setSingleLoading(true)
    try {
      const res = await sendTaxRequestByEmail(clean)
      setOk(`E-mail odeslán na: ${res.sentTo}`)
      setSingleLink(res.link)
      setSingleExpiresAt(res.expiresAt)
      setSingleEmail('')
    } catch (e: any) {
      setErr(e?.message || 'Nepodařilo se odeslat e-mail.')
    } finally {
      setSingleLoading(false)
    }
  }

  const missingCount = useMemo(() => rows.filter((u) => !isAddressComplete(u)).length, [rows])
  const completeCount = useMemo(() => rows.filter((u) => isAddressComplete(u)).length, [rows])

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 900, flex: 1 }}>
          Daňové údaje – žádosti & re-check
        </Typography>

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

      {/* Filters + Search */}
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, mb: 2 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip
                label={`Chybí údaje (${missingCount})`}
                color={mode === 'missing' ? 'primary' : 'default'}
                onClick={() => setMode('missing')}
              />
              <Chip
                label={`Údaje OK (${completeCount})`}
                color={mode === 'complete' ? 'primary' : 'default'}
                onClick={() => setMode('complete')}
              />
              <Chip
                label={`Všichni (${rows.length})`}
                color={mode === 'all' ? 'primary' : 'default'}
                onClick={() => setMode('all')}
              />
            </Stack>

            <TextField
              label="Hledat (email, jméno, město)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              fullWidth
            />
          </Stack>

          {/* Quick select via autocomplete */}
          <Autocomplete
            options={filtered}
            getOptionLabel={(u) => u.email}
            value={null}
            onChange={(_e, value) => {
              if (value?.id) toggle(value.id, true)
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Rychle vybrat e-mail"
                placeholder="Začněte psát e-mail…"
              />
            )}
          />

          <Divider />

          {/* Selection actions */}
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Tooltip title="Vybrat vše ve filtrování">
                <span>
                  <Button
                    variant="outlined"
                    startIcon={<SelectAllIcon />}
                    onClick={selectAllFiltered}
                    disabled={filteredIds.length === 0}
                  >
                    Vybrat vše (filtr)
                  </Button>
                </span>
              </Tooltip>

              <Tooltip title="Zrušit výběr ve filtrování">
                <span>
                  <Button
                    variant="text"
                    startIcon={<ClearIcon />}
                    onClick={clearFiltered}
                    disabled={filteredIds.length === 0}
                  >
                    Odznačit (filtr)
                  </Button>
                </span>
              </Tooltip>

              <Tooltip title="Zrušit celý výběr">
                <span>
                  <Button
                    variant="text"
                    color="inherit"
                    onClick={clearAll}
                    disabled={selectedCount === 0}
                  >
                    Zrušit vše
                  </Button>
                </span>
              </Tooltip>

              <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                Vybráno: <strong>{selectedCount}</strong>
              </Typography>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ ml: 'auto' }}>
              <Button
                variant="contained"
                startIcon={<RequestQuoteIcon />}
                disabled={sending || selectedCount === 0}
                onClick={sendMissing}
              >
                Požádat o doplnění údajů
              </Button>

              <Button
                variant="outlined"
                startIcon={<MarkEmailUnreadIcon />}
                disabled={sending || selectedCount === 0}
                onClick={sendRecheck}
              >
                Re-check (údaje OK)
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </Paper>

      {/* Table */}
      <Paper variant="outlined" sx={{ p: 0, borderRadius: 3, overflow: 'hidden' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={allFilteredSelected}
                  indeterminate={!allFilteredSelected && selectedCount > 0 && filteredIds.some((id) => selected[id])}
                  onChange={(e) => {
                    if (e.target.checked) selectAllFiltered()
                    else clearFiltered()
                  }}
                />
              </TableCell>
              <TableCell>E-mail</TableCell>
              <TableCell>Stav</TableCell>
              <TableCell>Jméno</TableCell>
              <TableCell>Adresa</TableCell>
              <TableCell>Poslední žádost</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {filtered.map((u: any) => {
              const complete = !!u.__complete
              const name = [u.firstName, u.lastName].filter(Boolean).join(' ')
              const addr = [u.street, u.streetNo, u.zip, u.city].filter(Boolean).join(' ')
              const sentAt = u.taxRequestSentAt ? new Date(u.taxRequestSentAt).toLocaleString() : '—'

              return (
                <TableRow key={u.id} hover>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={!!selected[u.id]}
                      onChange={(e) => toggle(u.id, e.target.checked)}
                    />
                  </TableCell>

                  <TableCell sx={{ fontWeight: 700 }}>{u.email}</TableCell>

                  <TableCell>
                    <Chip
                      size="small"
                      label={complete ? 'OK' : 'Chybí údaje'}
                      color={complete ? 'success' : 'warning'}
                      variant="outlined"
                    />
                  </TableCell>

                  <TableCell>{name || '—'}</TableCell>
                  <TableCell>{addr || '—'}</TableCell>
                  <TableCell>{sentAt}</TableCell>
                </TableRow>
              )
            })}

            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  Žádné záznamy (dle filtru).
                </TableCell>
              </TableRow>
            )}

            {loading && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={22} />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* One-off single email sender (kept for convenience) */}
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, mt: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 1 }}>
          Jednorázové odeslání (ručně)
        </Typography>

        <form onSubmit={onSendSingle}>
          <Stack spacing={2}>
            <TextField
              label="E-mail uživatele"
              type="email"
              value={singleEmail}
              onChange={(e) => setSingleEmail(e.target.value)}
              fullWidth
            />

            <Button
              type="submit"
              variant="outlined"
              startIcon={<RequestQuoteIcon />}
              disabled={singleLoading}
              sx={{ alignSelf: 'flex-start' }}
            >
              Odeslat e-mail s odkazem
            </Button>

            {singleExpiresAt && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Platnost do: {new Date(singleExpiresAt).toLocaleString()}
              </Typography>
            )}

            {singleLink && (
              <Alert severity="info">
                Odkaz byl vygenerován (zkontrolujte e-mail): {singleLink}
              </Alert>
            )}
          </Stack>
        </form>
      </Paper>

      <Alert severity="warning" sx={{ mt: 2 }}>
        Poznámka: Pokud backend ještě nemá <code>GET /api/tax/admin/users</code>, stránka ukáže chybu.
        V tom případě doplníme endpoint v <code>backend/src/routes/tax.ts</code>.
      </Alert>
    </Container>
  )
}