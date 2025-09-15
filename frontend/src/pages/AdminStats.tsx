import React, { useEffect, useState } from 'react'
import {
  Box, Container, Typography, Stack, TextField, Button, Tabs, Tab, Paper, Table, TableHead, TableRow, TableCell, TableBody, Alert
} from '@mui/material'

const BASE = (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/+$/,'') || ''

function fmtMoney(czk: number) { return (czk/1).toLocaleString('cs-CZ') + ' Kč' }

export default function AdminStats() {
  const [tab, setTab] = useState(0)
  const [from, setFrom] = useState<string>('')
  const [to, setTo] = useState<string>('')

  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [payments, setPayments] = useState<any>(null)
  const [pledges, setPledges] = useState<any>(null)
  const [expected, setExpected] = useState<any>(null)

  function qs() {
    const p = new URLSearchParams()
    if (from) p.set('from', from)
    if (to) p.set('to', to)
    const s = p.toString()
    return s ? `?${s}` : ''
  }

  async function loadAll() {
    setLoading(true); setErr(null)
    try {
      const [p, pl, ex] = await Promise.all([
        fetch(BASE + '/api/admin/stats/payments' + qs(), { headers: authH() }).then(r => r.json()),
        fetch(BASE + '/api/admin/stats/pledges' + qs(), { headers: authH() }).then(r => r.json()),
        fetch(BASE + '/api/admin/stats/expected' + qs(), { headers: authH() }).then(r => r.json()),
      ])
      if (!p.ok) throw new Error(p.error || 'payments failed')
      if (!pl.ok) throw new Error(pl.error || 'pledges failed')
      if (!ex.ok) throw new Error(ex.error || 'expected failed')
      setPayments(p)
      setPledges(pl)
      setExpected(ex)
    } catch (e: any) {
      setErr(e?.message || 'Načtení statistik selhalo')
    } finally {
      setLoading(false)
    }
  }

  function authH() {
    const t = sessionStorage.getItem('accessToken')
    return t ? { Authorization: 'Bearer ' + t } : {}
  }

  useEffect(() => { loadAll() }, []) // first load

  function quickThisMonth() {
    const now = new Date()
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    setFrom(start.toISOString().slice(0,10))
    setTo(end.toISOString().slice(0,10))
  }

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ fontWeight: 900, mb: 2 }}>Statistiky</Typography>

      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center">
          <TextField
            label="Od (YYYY-MM-DD)"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <TextField
            label="Do (YYYY-MM-DD)"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <Button onClick={quickThisMonth}>Tento měsíc</Button>
          <Box flex={1} />
          <Button variant="contained" onClick={loadAll} disabled={loading}>
            {loading ? 'Načítám…' : 'Načíst'}
          </Button>
        </Stack>
      </Paper>

      <Tabs value={tab} onChange={(_,v)=>setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Platby" />
        <Tab label="Pledges" />
        <Tab label="Očekávané" />
      </Tabs>

      {tab === 0 && payments && (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
            Přijaté platby: {payments.count} (celkem {fmtMoney(payments.total)})
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Datum</TableCell>
                <TableCell>Uživatel</TableCell>
                <TableCell>Zvíře</TableCell>
                <TableCell>Zdroj</TableCell>
                <TableCell>Stav</TableCell>
                <TableCell align="right">Částka</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payments.rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>{new Date(r.createdAt).toLocaleString('cs-CZ')}</TableCell>
                  <TableCell>{r.userEmail || '—'}</TableCell>
                  <TableCell>{r.animalName || r.animalId || '—'}</TableCell>
                  <TableCell>{r.source}</TableCell>
                  <TableCell>{r.status}</TableCell>
                  <TableCell align="right">{fmtMoney(r.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {tab === 1 && pledges && (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
            Pledges: {pledges.count} (součet {fmtMoney(pledges.sum)})
          </Typography>
          <Box sx={{ mb: 1 }}>
            {Object.entries(pledges.byStatus || {}).map(([k, v]: any) => (
              <Typography key={k} variant="body2" sx={{ mr: 2, display: 'inline-block' }}>
                <b>{k}</b>: {v.count} / {fmtMoney(v.sum)}
              </Typography>
            ))}
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Datum</TableCell>
                <TableCell>E-mail</TableCell>
                <TableCell>Zvíře</TableCell>
                <TableCell>Metoda</TableCell>
                <TableCell>Stav</TableCell>
                <TableCell align="right">Částka</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pledges.rows.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell>{new Date(p.createdAt).toLocaleString('cs-CZ')}</TableCell>
                  <TableCell>{p.email}</TableCell>
                  <TableCell>{p.animalId}</TableCell>
                  <TableCell>{p.method}</TableCell>
                  <TableCell>{p.status}</TableCell>
                  <TableCell align="right">{fmtMoney(p.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {tab === 2 && expected && (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
            Očekávané (měsíční): {expected.activeCount} aktivních · {fmtMoney(expected.totalMonthly)}
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Uživatel</TableCell>
                <TableCell>Zvíře</TableCell>
                <TableCell align="right">Měsíčně</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {expected.rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>{r.userEmail || '—'}</TableCell>
                  <TableCell>{r.animalName || r.animalId || '—'}</TableCell>
                  <TableCell align="right">{fmtMoney(r.monthlyAmount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Container>
  )
}