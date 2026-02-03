import React, { useEffect, useMemo, useState } from 'react'
import {
  Container,
  Typography,
  Stack,
  Paper,
  Button,
  TextField,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
  Alert,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Box,
} from '@mui/material'
import { getJSON, qs, apiUrl, getToken } from '../services/api'

function ymRangeOf(date = new Date()) {
  const y = date.getFullYear()
  const m = date.getMonth()
  const from = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10)
  const to = new Date(Date.UTC(y, m + 1, 1)).toISOString().slice(0, 10)
  return { from, to }
}

function yRangeOf(date = new Date()) {
  const y = date.getFullYear()
  const from = new Date(Date.UTC(y, 0, 1)).toISOString().slice(0, 10)
  const to = new Date(Date.UTC(y + 1, 0, 1)).toISOString().slice(0, 10)
  return { from, to }
}

type Props = { embedded?: boolean }

type AnimalAggRow = {
  animalId: string
  animalName: string | null
  donorsActive: number
  monthlyActiveSum: number
  paidSumSubscriptions: number
  paidSumPledges: number
  paidSumTotal: number
}

type AdoptionOverview = {
  promisedCount: number
  promisedSumCZK: number
  paidCount: number
  paidSumCZK: number
}

export default function AdminStats({ embedded = false }: Props) {
  // ✅ added "animals"
  const [tab, setTab] = useState<'payments' | 'pledges' | 'expected' | 'animals'>('payments')
  const [range, setRange] = useState<{ from?: string; to?: string }>(ymRangeOf())
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [payments, setPayments] = useState<any>(null)
  const [pledges, setPledges] = useState<any>(null)
  const [expected, setExpected] = useState<any>(null)

  // ✅ new state for animal aggregation
  const [animals, setAnimals] = useState<{ count: number; rows: AnimalAggRow[] } | null>(null)

  // ✅ NEW: overview state (promised vs paid)
  const [overview, setOverview] = useState<AdoptionOverview | null>(null)
  const [overviewErr, setOverviewErr] = useState<string | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(false)

  const params = useMemo(() => {
    const p: Record<string, string> = {}
    // Animals stats do not need date-range (keep range for other tabs)
    if (tab !== 'animals') {
      if (range?.from) p.from = range.from
      if (range?.to) p.to = range.to
    }
    return p
  }, [range, tab])

  const endpoint = useMemo(() => {
    if (tab === 'payments') return '/api/admin/stats/payments'
    if (tab === 'pledges') return '/api/admin/stats/pledges'
    if (tab === 'expected') return '/api/admin/stats/expected'
    return '/api/admin/stats/animals'
  }, [tab])

  async function load() {
    setErr(null)
    setLoading(true)
    try {
      const url = `${endpoint}${qs(params)}`
      const data = await getJSON<any>(url)

      if (tab === 'payments') setPayments(data)
      else if (tab === 'pledges') setPledges(data)
      else if (tab === 'expected') setExpected(data)
      else setAnimals(data)
    } catch (e: any) {
      setErr(e?.message || 'Chyba načítání statistik')
    } finally {
      setLoading(false)
    }
  }

  // Reload when tab or date-range changes
  useEffect(() => {
    const t = setTimeout(load, 150)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, params.from, params.to])

  const showDateRange = tab !== 'animals'

  // ✅ NEW: Load adoption overview (promised vs paid)
  async function loadOverview() {
    setOverviewErr(null)
    setOverviewLoading(true)
    try {
      // Overview should follow date range (when date range is visible), otherwise use current range anyway.
      const q = showDateRange ? qs({ ...(range?.from ? { from: range.from } : {}), ...(range?.to ? { to: range.to } : {}) }) : qs({ ...(range?.from ? { from: range.from } : {}), ...(range?.to ? { to: range.to } : {}) })

      const [pays, pled] = await Promise.all([
        getJSON<any>(`/api/admin/stats/payments${q}`),
        getJSON<any>(`/api/admin/stats/pledges${q}`),
      ])

      const paidRows = Array.isArray(pays?.rows) ? pays.rows : []
      const paidCount = paidRows.filter((r: any) => String(r?.status || '').toUpperCase() === 'PAID').length
      const paidSumCZK = Number(pays?.total || 0) || 0

      const promisedCount = Number(pled?.count || 0) || 0
      const promisedSumCZK = Number(pled?.sum || 0) || 0

      setOverview({
        promisedCount,
        promisedSumCZK,
        paidCount,
        paidSumCZK,
      })
    } catch (e: any) {
      setOverviewErr(e?.message || 'Chyba načítání přehledu adopcí')
      setOverview(null)
    } finally {
      setOverviewLoading(false)
    }
  }

  useEffect(() => {
    // Load once + whenever date range changes
    const t = setTimeout(loadOverview, 150)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range?.from, range?.to])

  // ✅ NEW: CSV export (UTF-8)
  async function downloadAdoptersCsv() {
    setErr(null)
    try {
      // Backend endpoint to implement:
      // GET /api/admin/stats/adopters.csv
      // -> returns text/csv; charset=utf-8
      const token = getToken()
      const res = await fetch(apiUrl('/api/admin/stats/adopters.csv'), {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      })
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(txt || `Export selhal (HTTP ${res.status})`)
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dogpoint-adopce-export-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e: any) {
      setErr(e?.message || 'Export CSV selhal')
    }
  }

  const content = (
    <>
      {!embedded && (
        <Typography variant="h4" sx={{ fontWeight: 900, mb: 2 }}>
          Statistiky
        </Typography>
      )}

      {/* ✅ NEW: Adoption overview */}
      <Paper sx={{ p: 2, mb: 2, borderRadius: 3 }} variant="outlined">
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="stretch">
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
              Adopce – přehled
            </Typography>

            {overviewErr && (
              <Alert severity="warning" sx={{ mb: 1 }}>
                {String(overviewErr)}
              </Alert>
            )}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Stat
                label="Přísliby (neuhrazené)"
                value={
                  overviewLoading
                    ? 'Načítám…'
                    : `${overview?.promisedCount ?? 0} / ${overview?.promisedSumCZK ?? 0} CZK`
                }
              />
              <Stat
                label="Uhrazeno (cash)"
                value={
                  overviewLoading
                    ? 'Načítám…'
                    : `${overview?.paidCount ?? 0} / ${overview?.paidSumCZK ?? 0} CZK`
                }
              />
            </Stack>

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Pozn.: „Přísliby“ = neuhrazené (Pledge PENDING). „Uhrazeno“ = Payment PAID.
            </Typography>
          </Box>

          <Divider flexItem orientation="vertical" sx={{ display: { xs: 'none', sm: 'block' } }} />

          <Box sx={{ minWidth: { xs: '100%', sm: 280 } }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
              Export
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Export všech e-mailů + adres + adoptovaných zvířat (CSV / UTF-8).
            </Typography>
            <Button variant="contained" onClick={downloadAdoptersCsv}>
              Stáhnout CSV
            </Button>

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Endpoint: <code>/api/admin/stats/adopters.csv</code>
            </Typography>
          </Box>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2, mb: 2, borderRadius: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <ToggleButtonGroup exclusive value={tab} onChange={(_, v) => v && setTab(v)} size="small">
            <ToggleButton value="payments">Předplatné (uhrazené)</ToggleButton>
            <ToggleButton value="pledges">Neuhrazené přísliby</ToggleButton>
            <ToggleButton value="expected">Očekávaný měsíční příjem</ToggleButton>

            {/* ✅ NEW TAB */}
            <ToggleButton value="animals">Zvířata</ToggleButton>
          </ToggleButtonGroup>

          {showDateRange && (
            <>
              <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />

              <TextField
                type="date"
                label="Od"
                size="small"
                value={range?.from || ''}
                onChange={(e) => setRange((r) => ({ ...(r || {}), from: e.target.value || undefined }))}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                type="date"
                label="Do"
                size="small"
                value={range?.to || ''}
                onChange={(e) => setRange((r) => ({ ...(r || {}), to: e.target.value || undefined }))}
                InputLabelProps={{ shrink: true }}
              />

              <Box sx={{ flex: 1 }} />

              <Button onClick={() => setRange(ymRangeOf())}>Tento měsíc</Button>
              <Button onClick={() => setRange(yRangeOf())}>Tento rok</Button>
              <Button onClick={() => setRange({})}>Vymazat</Button>
            </>
          )}

          {!showDateRange && <Box sx={{ flex: 1 }} />}
        </Stack>
      </Paper>

      {err && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {String(err)}
        </Alert>
      )}

      {tab === 'payments' && (
        <Paper sx={{ p: 2, borderRadius: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
            <Stat label="Počet" value={payments?.count ?? '—'} />
            <Stat label="Součet (CZK)" value={payments?.total ?? '—'} />
          </Stack>

          <DataTable
            loading={loading}
            rows={payments?.rows || []}
            columns={[
              { key: 'createdAt', label: 'Datum' },
              { key: 'amount', label: 'Částka' },
              { key: 'status', label: 'Stav' },
              { key: 'provider', label: 'Poskytovatel' },
              { key: 'userEmail', label: 'E-mail' },
              { key: 'animalName', label: 'Zvíře' },
              { key: 'source', label: 'Zdroj' },
            ]}
          />
        </Paper>
      )}

      {tab === 'pledges' && (
        <Paper sx={{ p: 2, borderRadius: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
            <Stat label="Počet" value={pledges?.count ?? '—'} />
            <Stat label="Součet (CZK)" value={pledges?.sum ?? '—'} />
          </Stack>

          <DataTable
            loading={loading}
            rows={pledges?.rows || []}
            columns={[
              { key: 'createdAt', label: 'Datum' },
              { key: 'email', label: 'E-mail' },
              { key: 'animalId', label: 'Zvíře' },
              { key: 'amount', label: 'Částka' },
              { key: 'status', label: 'Stav' },
              { key: 'method', label: 'Metoda' },
            ]}
          />
        </Paper>
      )}

      {tab === 'expected' && (
        <Paper sx={{ p: 2, borderRadius: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
            <Stat label="Aktivní odběratelé" value={expected?.activeCount ?? '—'} />
            <Stat label="Měsíčně očekáváno (CZK)" value={expected?.totalMonthly ?? '—'} />
          </Stack>

          <DataTable
            loading={loading}
            rows={expected?.rows || []}
            columns={[
              { key: 'userEmail', label: 'E-mail' },
              { key: 'animalName', label: 'Zvíře' },
              { key: 'monthlyAmount', label: 'Částka/měsíc' },
              { key: 'currency', label: 'Měna' },
            ]}
          />
        </Paper>
      )}

      {/* ✅ NEW: per-animal aggregation */}
      {tab === 'animals' && (
        <Paper sx={{ p: 2, borderRadius: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
            <Stat label="Počet zvířat" value={animals?.count ?? '—'} />
          </Stack>

          <DataTable
            loading={loading}
            rows={animals?.rows || []}
            columns={[
              { key: 'animalName', label: 'Zvíře' },
              { key: 'donorsActive', label: 'Aktivní dárci' },
              { key: 'monthlyActiveSum', label: 'Měsíčně aktivní (CZK)' },
              { key: 'paidSumSubscriptions', label: 'Uhrazeno (předplatné)' },
              { key: 'paidSumPledges', label: 'Uhrazeno (přísliby)' },
              { key: 'paidSumTotal', label: 'Uhrazeno celkem' },
            ]}
          />
        </Paper>
      )}
    </>
  )

  if (embedded) return content

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {content}
    </Container>
  )
}

function Stat(props: any) {
  const { label, value } = props || {}
  return (
    <Paper sx={{ p: 1.5, minWidth: 180, borderRadius: 3 }} variant="outlined">
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h6" sx={{ fontWeight: 800 }}>
        {value}
      </Typography>
    </Paper>
  )
}

function DataTable(props: any) {
  const rows = props?.rows || []
  const columns = props?.columns || []
  const loading = props?.loading

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            {columns.map((c: any) => (
              <TableCell key={c.key}>{c.label}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={columns.length}>Načítám…</TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length}>Žádná data</TableCell>
            </TableRow>
          ) : (
            rows.map((r: any, idx: number) => (
              <TableRow key={r?.id || r?.animalId || `${r?.createdAt || ''}-${r?.email || ''}-${idx}`}>
                {columns.map((c: any) => (
                  <TableCell key={c.key}>
                    {c.key === 'createdAt'
                      ? r?.[c.key]
                        ? new Date(r[c.key]).toLocaleString()
                        : ''
                      : String(r?.[c.key] ?? '')}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Box>
  )
}