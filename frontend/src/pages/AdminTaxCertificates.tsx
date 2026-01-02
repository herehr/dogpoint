import React, { useState } from 'react'
import { Container, Paper, Stack, Typography, TextField, Button, Alert, FormControlLabel, Checkbox } from '@mui/material'
import { apiUrl, authHeader } from '../api'

export default function AdminTaxCertificates() {
  const [year, setYear] = useState<number>(new Date().getFullYear() - 1)
  const [emails, setEmails] = useState('')
  const [dryRun, setDryRun] = useState(true)
  const [limit, setLimit] = useState<number>(5)

  const [ok, setOk] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function run() {
    setOk(null); setErr(null); setLoading(true)
    try {
      const list = emails
        .split(/[\n,; ]+/g)
        .map(s => s.trim().toLowerCase())
        .filter(Boolean)

      const res = await fetch(apiUrl('/api/tax-certificates/run'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({
          year,
          dryRun,
          emails: list.length ? list : undefined,
          limit: list.length ? undefined : limit, // if no emails, use limit for safety
        }),
      })

      const txt = await res.text()
      if (!res.ok) throw new Error(`API ${res.status}: ${txt || res.statusText}`)
      const data = txt ? JSON.parse(txt) : {}
      setOk(`Hotovo: year=${data.year}, processed=${data.processed}, dryRun=${data.dryRun}`)
    } catch (e: any) {
      setErr(e?.message || 'Spuštění selhalo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Typography variant="h5" sx={{ fontWeight: 900, mb: 2 }}>
        Potvrzení o daru – odeslání
      </Typography>

      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
      {ok && <Alert severity="success" sx={{ mb: 2 }}>{ok}</Alert>}

      <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
        <Stack spacing={2}>
          <TextField
            label="Rok (za který je potvrzení)"
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />

          <FormControlLabel
            control={<Checkbox checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />}
            label="Dry-run (neodesílat e-maily, jen vypsat počet)"
          />

          <TextField
            label="Testovací e-maily (volitelné) — oddělte čárkou / novým řádkem"
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            multiline
            minRows={3}
            placeholder="např.\nadmin@dogpoint.cz\n..."
          />

          {!emails.trim() && (
            <TextField
              label="Limit (když nejsou vyplněné e-maily)"
              type="number"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              helperText="Bez e-mailů se použije limit pro bezpečný test."
            />
          )}

          <Button variant="contained" onClick={run} disabled={loading}>
            Spustit odeslání nyní
          </Button>
        </Stack>
      </Paper>
    </Container>
  )
}