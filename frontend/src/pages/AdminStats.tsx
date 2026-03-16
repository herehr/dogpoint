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
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { useAuth } from '../context/AuthContext'
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

type AdoptionOverviewResp = {
  ok: boolean
  promised?: { count: number; monthlySumCZK: number }
  cashed?: { count: number; sumCZK: number }
}

type StatsOverviewResp = {
  ok: boolean
  flow?: {
    subscriptionsActiveStripe?: number
    subscriptionsActiveFio?: number
    subscriptionsPendingStripe?: number
    subscriptionsPendingFio?: number
    subscriptionsPending?: number
  }
}

// ✅ Only ADMIN token for admin endpoints
function getAdminToken(): string | null {
  return (
    sessionStorage.getItem('adminToken') ||
    localStorage.getItem('adminToken') ||
    localStorage.getItem('accessToken')
  )
}

function authHeaders(): Record<string, string> {
  const t = getToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

export default function AdminStats({ embedded = false }: Props) {
  const { token: authToken } = useAuth()
  const token = authToken ?? getToken()

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

  const [statsOverview, setStatsOverview] = useState<StatsOverviewResp | null>(null)
  const [statsOverviewErr, setStatsOverviewErr] = useState<string | null>(null)
  const [statsOverviewLoading, setStatsOverviewLoading] = useState(false)

  const [fioImportResult, setFioImportResult] = useState<any>(null)
  const [fioImportErr, setFioImportErr] = useState<string | null>(null)
  const [fioImportLoading, setFioImportLoading] = useState(false)

  const [stripeSyncResult, setStripeSyncResult] = useState<any>(null)
  const [stripeSyncErr, setStripeSyncErr] = useState<string | null>(null)
  const [stripeSyncLoading, setStripeSyncLoading] = useState(false)

  const params = useMemo(() => {
    const p: Record<string, string> = {}
    if (tab !== 'animals') {
      if (range?.from) p.from = range.from
      if (range?.to) p.to = range.to
    }
    return p
  }, [range, tab])

  const incomeByProviderChart = useMemo(() => {
    const rows = payments?.rows || []
    const monthMap = new Map<string, { stripe: number; fio: number }>()
    const monthNames = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro']
    for (const r of rows) {
      if (String(r?.status ?? '').toUpperCase() !== 'PAID') continue
      const amt = Number(r?.amount ?? 0) || 0
      if (amt <= 0) continue
      const d = r?.createdAt ? new Date(r.createdAt) : null
      if (!d || isNaN(d.getTime())) continue
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const prov = String(r?.provider ?? '').toUpperCase()
      const isStripe = prov === 'STRIPE'
      const isFio = prov === 'FIO'
      if (!monthMap.has(key)) monthMap.set(key, { stripe: 0, fio: 0 })
      const entry = monthMap.get(key)!
      if (isStripe) entry.stripe += amt
      else if (isFio) entry.fio += amt
    }
    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => {
        const [y, m] = key.split('-')
        const monthLabel = `${monthNames[parseInt(m, 10) - 1]} ${y}`
        return { month: monthLabel, STRIPE: v.stripe, FIO: v.fio }
      })
  }, [payments?.rows])

  const endpoint = useMemo(() => {
    if (tab === 'payments') return '/api/admin/stats/payments'
    if (tab === 'pledges') return '/api/admin/stats/pledges'
    if (tab === 'expected') return '/api/admin/stats/expected'
    return '/api/admin/stats/animals'
  }, [tab])

  async function load() {
    if (!token) return
    setErr(null)
    setLoading(true)
    try {
      const url = `${endpoint}${qs(params)}`
      const headers = token ? { Authorization: `Bearer ${token}` } : authHeaders()
      const data = await getJSON<any>(url, { headers })

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
    if (token) {
      const timer = setTimeout(load, 150)
      return () => clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tab, params.from, params.to])

  const showDateRange = tab !== 'animals'

  async function loadAdoptionOverview() {
    const t = token ?? getToken()
    if (!t) return
    setAdoptErr(null)
    setAdoptLoading(true)
    try {
      const headers = { Authorization: `Bearer ${t}` }
      const r = await getJSON<AdoptionOverviewResp>('/api/admin/stats/adoptions/overview', { headers })
      setAdopt(r)
    } catch (e: any) {
      setAdopt(null)
      setAdoptErr(e?.message || 'Chyba načítání přehledu adopcí')
    } finally {
      setAdoptLoading(false)
    }
  }

  useEffect(() => {
    if (token) {
      const timer = setTimeout(loadAdoptionOverview, 150)
      return () => clearTimeout(timer)
    }
  }, [token])

  async function loadStatsOverview() {
    const t = token ?? getToken()
    if (!t) return
    setStatsOverviewErr(null)
    setStatsOverviewLoading(true)
    try {
      const headers = { Authorization: `Bearer ${t}` }
      const r = await getJSON<StatsOverviewResp>('/api/admin/stats', { headers })
      setStatsOverview(r)
    } catch (e: any) {
      setStatsOverview(null)
      setStatsOverviewErr(e?.message || 'Chyba načítání přehledu statistik')
    } finally {
      setStatsOverviewLoading(false)
    }
  }

  useEffect(() => {
    if (token) {
      const timer = setTimeout(loadStatsOverview, 150)
      return () => clearTimeout(timer)
    }
  }, [token])

  async function runFioImport(daysBack = 30) {
    setFioImportErr(null)
    setFioImportResult(null)
    setFioImportLoading(true)
    try {
      const to = new Date()
      const from = new Date()
      from.setDate(from.getDate() - daysBack)
      const fromStr = from.toISOString().slice(0, 10)
      const toStr = to.toISOString().slice(0, 10)
      const t = token ?? getToken() ?? getAdminToken()
      if (!t?.trim()) throw new Error('Nejste přihlášen jako admin.')
      const res = await fetch(apiUrl(`/api/fio/import?from=${fromStr}&to=${toStr}`), {
        headers: { Authorization: `Bearer ${t}` },
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as any)?.error || data?.detail || `HTTP ${res.status}`)
      setFioImportResult(data)
      loadAdoptionOverview()
      loadStatsOverview()
      if (tab === 'payments') load()
    } catch (e: any) {
      setFioImportErr(e?.message || 'FIO import selhal')
    } finally {
      setFioImportLoading(false)
    }
  }

  async function runStripeSync() {
    setStripeSyncErr(null)
    setStripeSyncResult(null)
    setStripeSyncLoading(true)
    try {
      const t = token ?? getToken() ?? getAdminToken()
      if (!t?.trim()) throw new Error('Nejste přihlášen jako admin.')
      const res = await fetch(apiUrl('/api/admin/stripe-sync-payments'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as any)?.error || data?.detail || `HTTP ${res.status}`)
      setStripeSyncResult(data)
      loadAdoptionOverview()
      loadStatsOverview()
      if (tab === 'payments') load()
    } catch (e: any) {
      setStripeSyncErr(e?.message || 'Stripe sync selhal')
    } finally {
      setStripeSyncLoading(false)
    }
  }

  async function downloadAdoptersCsv() {
    setErr(null)
    try {
      const t = token ?? getToken() ?? getAdminToken()
      if (!t) {
        throw new Error('Chybí adminToken. Přihlas se jako ADMIN (Admin login) a zkus export znovu.')
      }

      const res = await fetch(apiUrl('/api/admin/stats/adoptions/export.csv'), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${t}`,
          Accept: 'text/csv',
        },
        credentials: 'include',
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

            <Typography variant="subtitle2" sx={{ fontWeight: 800, mt: 2, mb: 1 }}>
              Předplatné – stav podle platby
            </Typography>
            {statsOverviewErr && (
              <Alert severity="warning" sx={{ mb: 1 }}>
                {String(statsOverviewErr)}
              </Alert>
            )}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap">
              <Stat
                label="ACTIVE (Stripe)"
                value={statsOverviewLoading ? 'Načítám…' : String(statsOverview?.flow?.subscriptionsActiveStripe ?? '—')}
              />
              <Stat
                label="ACTIVE (FIO)"
                value={statsOverviewLoading ? 'Načítám…' : String(statsOverview?.flow?.subscriptionsActiveFio ?? '—')}
              />
              <Stat
                label="PENDING (FIO)"
                value={statsOverviewLoading ? 'Načítám…' : String(statsOverview?.flow?.subscriptionsPendingFio ?? '—')}
              />
              <Stat
                label="PENDING (celkem)"
                value={statsOverviewLoading ? 'Načítám…' : String(statsOverview?.flow?.subscriptionsPending ?? '—')}
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

            <Typography variant="subtitle2" sx={{ fontWeight: 800, mt: 2, mb: 1 }}>
              FIO import
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Načte platby z FIO API do tabulky Payment (poslední měsíc).
            </Typography>
            {fioImportErr && (
              <Alert severity="error" sx={{ mb: 1 }}>
                {fioImportErr}
              </Alert>
            )}
            {fioImportResult && (
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Vytvořeno:</strong> {fioImportResult.createdPayments} plateb
                {typeof fioImportResult.incoming === 'number' && (
                  <> · Příchozí: {fioImportResult.incoming}</>
                )}
                {fioImportResult.skippedNoMatch > 0 && (
                  <> · Bez shody VS: {fioImportResult.skippedNoMatch}</>
                )}
                {fioImportResult.skippedNoVS > 0 && (
                  <> · Bez VS: {fioImportResult.skippedNoVS}</>
                )}
                {typeof fioImportResult.subsWithVS === 'number' && (
                  <> · Předplatných s VS v DB: {fioImportResult.subsWithVS}</>
                )}
                {Array.isArray(fioImportResult.sampleNoMatchVS) &&
                  fioImportResult.sampleNoMatchVS.length > 0 && (
                    <>
                      {' '}
                      · Příklad VS bez shody: {fioImportResult.sampleNoMatchVS.join(', ')}
                    </>
                  )}
              </Typography>
            )}
            <Button
              variant="outlined"
              onClick={() => runFioImport(30)}
              disabled={fioImportLoading}
            >
              {fioImportLoading ? 'Načítám…' : 'Stáhnout FIO – poslední měsíc'}
            </Button>

            <Typography variant="subtitle2" sx={{ fontWeight: 800, mt: 2, mb: 1 }}>
              Stripe sync
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Načte platby z Stripe API (všechny uhrazené faktury) do tabulky Payment (recurring platby).
            </Typography>
            {stripeSyncErr && (
              <Alert severity="error" sx={{ mb: 1 }}>
                {stripeSyncErr}
              </Alert>
            )}
            {stripeSyncResult && (
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Stripe režim:</strong> {stripeSyncResult.stripeMode === 'live' ? 'LIVE (reálná data)' : stripeSyncResult.stripeMode === 'test' ? 'TEST (sandbox)' : stripeSyncResult.stripeMode ?? '?'}
                {' · '}
                <strong>Vytvořeno:</strong> {stripeSyncResult.created ?? 0} plateb
                {typeof stripeSyncResult.subscriptionsCreated === 'number' && stripeSyncResult.subscriptionsCreated > 0 && (
                  <> · Předplatných vytvořeno: {stripeSyncResult.subscriptionsCreated}</>
                )}
                {typeof stripeSyncResult.skipped === 'number' && (
                  <> · Přeskočeno (již existuje): {stripeSyncResult.skipped}</>
                )}
                {typeof stripeSyncResult.skippedNoSub === 'number' && (
                  <> · Bez shody předplatného: {stripeSyncResult.skippedNoSub}</>
                )}
                {typeof stripeSyncResult.skippedNoSubscription === 'number' && stripeSyncResult.skippedNoSubscription > 0 && (
                  <> · Jednorázové (bez sub): {stripeSyncResult.skippedNoSubscription}</>
                )}
                {typeof stripeSyncResult.invoicesFetched === 'number' && (
                  <> · Faktur ze Stripe: {stripeSyncResult.invoicesFetched}</>
                )}
              </Typography>
            )}
            <Button
              variant="outlined"
              onClick={runStripeSync}
              disabled={stripeSyncLoading}
            >
              {stripeSyncLoading ? 'Načítám…' : 'Stripe sync – stáhnout platby'}
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

          {incomeByProviderChart.length > 0 && (
            <Box sx={{ width: '100%', height: 320, mb: 3 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                Příjem podle platební metody (STRIPE / FIO)
              </Typography>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={incomeByProviderChart} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v} Kč`} />
                  <Tooltip formatter={(v) => `${Number(v ?? 0).toLocaleString('cs-CZ')} Kč`} />
                  <Legend />
                  <Bar dataKey="STRIPE" stackId="a" fill="#635BFF" name="STRIPE (karta)" />
                  <Bar dataKey="FIO" stackId="a" fill="#0EA5E9" name="FIO (bankovní převod)" />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          )}

          <DataTable
            loading={loading}
            rows={payments?.rows || []}
            columns={[
              { key: 'createdAt', label: 'Datum' },
              { key: 'amount', label: 'Částka' },
              { key: 'status', label: 'Stav' },
              { key: 'method', label: 'Metoda' },
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
              { key: 'animalName', label: 'Zvíře' },
              { key: 'amount', label: 'Částka' },
              { key: 'status', label: 'Stav' },
              { key: 'method', label: 'Metoda' },
              { key: 'source', label: 'Zdroj' },
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
                      : c.key === 'animalName'
                        ? String(r?.animalName ?? r?.animalId ?? '')
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