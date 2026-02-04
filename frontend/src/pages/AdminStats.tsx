// frontend/src/pages/AdminStats.tsx
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
import { getJSON, qs, apiUrl } from '../services/api'

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

type AdoptionOverviewResp = {
  ok: boolean
  promised?: { count: number; monthlySumCZK: number }
  cashed?: { count: number; sumCZK: number }
}

// ✅ Only ADMIN token for admin endpoints
function getAdminToken(): string | null {
  return sessionStorage.getItem('adminToken') || localStorage.getItem('adminToken')
}

export default function AdminStats({ embedded = false }: Props) {
  const [tab, setTab] = useState<'payments' | 'pledges' | 'expected' | 'animals'>('payments')
  const [range, setRange] = useState<{ from?: string; to?: string }>(ymRangeOf())
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [payments, setPayments] = useState<any>(null)
  const [pledges, setPledges] = useState<any>(null)
  const [expected, setExpected] = useState<any>(null)
  const [animals, setAnimals] = useState<{ count: number; rows: AnimalAggRow[] } | null>(null)

  const [adopt, setAdopt] = useState<AdoptionOverviewResp | null>(null)
  const [adoptErr, setAdoptErr] = useState<string | null>(null)
  const [adoptLoading, setAdoptLoading] = useState(false)

  const params = useMemo(() => {
    const p: Record<string, string> = {}
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

  useEffect(() => {
    const t = setTimeout(load, 150)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, params.from, params.to])

  const showDateRange = tab !== 'animals'

  async function loadAdoptionOverview() {
    setAdoptErr(null)
    setAdoptLoading(true)
    try {
      const r = await getJSON<AdoptionOverviewResp>('/api/admin/stats/adoptions/overview')
      setAdopt(r)
    } catch (e: any) {
      setAdopt(null)
      setAdoptErr(e?.message || 'Chyba načítání přehledu adopcí')
    } finally {
      setAdoptLoading(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(loadAdoptionOverview, 150)
    return () => clearTimeout(t)
  }, [])

  async function downloadAdoptersCsv() {
    setErr(null)
    try {
      const token = getAdminToken()
      if (!token) {
        throw new Error('Chybí adminToken. Přihlas se jako ADMIN (Admin login) a zkus export znovu.')
      }

      const res = await fetch(apiUrl('/api/admin/stats/adoptions/export.csv'), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'text/csv',
        },
      })

      if (res.status === 401 || res.status === 403) {
        const txt = await res.text().catch(() => '')
        throw new Error(txt || `Nemáš oprávnění (HTTP ${res.status}). Přihlas se jako ADMIN.`)
      }

      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(txt || `Export selhal (HTTP ${res.status})`)
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dogpoint-adopce-${new Date().toISOString().slice(0, 10)}.csv`
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

      <Paper sx={{ p: 2, mb: 2, borderRadius: 3 }} variant="outlined">
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="stretch">
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
              Adopce – přehled
            </Typography>

            {adoptErr && (
              <Alert severity="warning" sx={{ mb: 1 }}>
                {String(adoptErr)}
              </Alert>
            )}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Stat
                label="Přísliby (ACTIVE + PENDING)"
                value={
                  adoptLoading
                    ? 'Načítám…'
                    : `${adopt?.promised?.count ?? 0} / ${adopt?.promised?.monthlySumCZK ?? 0} Kč / měsíc`
                }
              />
              <Stat
                label="Uhrazeno (PAID)"
                value={adoptLoading ? 'Načítám…' : `${adopt?.cashed?.count ?? 0} / ${adopt?.cashed?.sumCZK ?? 0} Kč`}
              />
            </Stack>
          </Box>

          <Divider flexItem orientation="vertical" sx={{ display: { xs: 'none', md: 'block' } }} />

          <Box sx={{ minWidth: { xs: '100%', md: 320 } }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
              Export
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              E-maily + adresy + adoptovaná zvířata (CSV / UTF-8).
            </Typography>
            <Button variant="contained" onClick={downloadAdoptersCsv}>
              Stáhnout CSV
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Endpoint: <code>/api/admin/stats/adoptions/export.csv</code>
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