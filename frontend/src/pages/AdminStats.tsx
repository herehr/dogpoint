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
import { getJSON, qs } from '../services/api'

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

export default function AdminStats({ embedded = false }: Props) {
  const [tab, setTab] = useState<'payments' | 'pledges' | 'expected'>('payments')
  const [range, setRange] = useState<{ from?: string; to?: string }>(ymRangeOf())
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [payments, setPayments] = useState<any>(null)
  const [pledges, setPledges] = useState<any>(null)
  const [expected, setExpected] = useState<any>(null)

  const params = useMemo(() => {
    const p: Record<string, string> = {}
    if (range?.from) p.from = range.from
    if (range?.to) p.to = range.to
    return p
  }, [range])

  const endpoint = useMemo(() => {
    if (tab === 'payments') return '/api/admin/stats/payments'
    if (tab === 'pledges') return '/api/admin/stats/pledges'
    return '/api/admin/stats/expected'
  }, [tab])

  async function load() {
    setErr(null)
    setLoading(true)
    try {
      const url = `${endpoint}${qs(params)}`
      const data = await getJSON<any>(url)

      if (tab === 'payments') setPayments(data)
      else if (tab === 'pledges') setPledges(data)
      else setExpected(data)
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

  const content = (
    <>
      {!embedded && (
        <Typography variant="h4" sx={{ fontWeight: 900, mb: 2 }}>
          Statistiky
        </Typography>
      )}

      <Paper sx={{ p: 2, mb: 2, borderRadius: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <ToggleButtonGroup
            exclusive
            value={tab}
            onChange={(_, v) => v && setTab(v)}
            size="small"
          >
            <ToggleButton value="payments">Platby</ToggleButton>
            <ToggleButton value="pledges">Přísliby</ToggleButton>
            <ToggleButton value="expected">Očekávané</ToggleButton>
          </ToggleButtonGroup>

          <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />

          <TextField
            type="date"
            label="Od"
            size="small"
            value={range?.from || ''}
            onChange={(e) =>
              setRange((r) => ({ ...(r || {}), from: e.target.value || undefined }))
            }
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            type="date"
            label="Do"
            size="small"
            value={range?.to || ''}
            onChange={(e) =>
              setRange((r) => ({ ...(r || {}), to: e.target.value || undefined }))
            }
            InputLabelProps={{ shrink: true }}
          />

          <Box sx={{ flex: 1 }} />

          <Button onClick={() => setRange(ymRangeOf())}>Tento měsíc</Button>
          <Button onClick={() => setRange(yRangeOf())}>Tento rok</Button>
          <Button onClick={() => setRange({})}>Vymazat</Button>
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
              <TableRow key={r?.id || `${r?.createdAt || ''}-${r?.email || ''}-${idx}`}>
                {columns.map((c: any) => (
                  <TableCell key={c.key}>
                    {c.key === 'createdAt'
                      ? (r?.[c.key] ? new Date(r[c.key]).toLocaleString() : '')
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