// frontend/src/pages/AdminDashboard.tsx
import React, { useMemo, useState } from 'react'
import {
  Container,
  Typography,
  Paper,
  Grid,
  Button,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  Alert,
  Divider,
  Box,
} from '@mui/material'

import PeopleIcon from '@mui/icons-material/People'
import PetsIcon from '@mui/icons-material/Pets'
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary'
import DescriptionIcon from '@mui/icons-material/Description'
import BarChartIcon from '@mui/icons-material/BarChart'
import RequestQuoteIcon from '@mui/icons-material/RequestQuote'
import MarkEmailUnreadIcon from '@mui/icons-material/MarkEmailUnread'

import { Link as RouterLink } from 'react-router-dom'
import { runTaxCertificates } from '../api'

export default function AdminDashboard() {
  // ──────────────────────────────────────────────
  // Tax certificates dialog state
  // ──────────────────────────────────────────────
  const defaultYear = useMemo(() => {
    const y = new Date().getFullYear()
    // most of the time you send last year, but keep it editable
    return y - 1
  }, [])

  const [taxOpen, setTaxOpen] = useState(false)
  const [taxYear, setTaxYear] = useState<number>(defaultYear)
  const [taxIncludePledges, setTaxIncludePledges] = useState(true)
  const [taxLimit, setTaxLimit] = useState<number>(10)

  const [taxErr, setTaxErr] = useState<string | null>(null)
  const [taxOk, setTaxOk] = useState<string | null>(null)
  const [taxLoading, setTaxLoading] = useState(false)
  const [taxDryRunResult, setTaxDryRunResult] = useState<any>(null)

  function openTax() {
    setTaxErr(null)
    setTaxOk(null)
    setTaxDryRunResult(null)
    setTaxOpen(true)
  }

  async function doDryRun() {
    setTaxErr(null)
    setTaxOk(null)
    setTaxLoading(true)
    try {
      const data = await runTaxCertificates({
        year: Number(taxYear),
        dryRun: true,
        includePledges: Boolean(taxIncludePledges),
        limit: Number(taxLimit) || 10,
      })
      setTaxDryRunResult(data)
      setTaxOk(
        `Dry-run hotový: ${data?.summary?.recipients ?? 0} příjemců, celkem ${data?.summary?.totalCzk ?? 0} Kč.`,
      )
    } catch (e: any) {
      setTaxErr(e?.message || 'Dry-run selhal')
    } finally {
      setTaxLoading(false)
    }
  }

  async function doSendNow() {
    setTaxErr(null)
    setTaxOk(null)
    setTaxLoading(true)
    try {
      const data = await runTaxCertificates({
        year: Number(taxYear),
        dryRun: false,
        includePledges: Boolean(taxIncludePledges),
        // intentionally no limit in real send unless you want it
      })
      setTaxDryRunResult(data)
      setTaxOk(
        `Odesláno: ${data?.sent ?? 0}, chyby: ${data?.failed ?? 0}.`,
      )
    } catch (e: any) {
      setTaxErr(e?.message || 'Odeslání selhalo')
    } finally {
      setTaxLoading(false)
    }
  }

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Typography variant="h5" sx={{ fontWeight: 900, mb: 2 }}>
        Admin panel
      </Typography>

      <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, mb: 3 }}>
        <Typography color="text.secondary">
          Úspěšné přihlášení. Vyberte sekci k správě.
        </Typography>
      </Paper>

      <Grid container spacing={2}>
        {/* 1) Zvířata */}
        <Grid item xs={12} sm={6} md={4}>
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, height: '100%' }}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <PetsIcon />
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Zvířata
                </Typography>
              </Stack>
              <Typography color="text.secondary">
                Přehled a správa záznamů zvířat.
              </Typography>
              <Button
                component={RouterLink}
                to="/admin/animals"
                variant="contained"
                size="small"
                sx={{ alignSelf: 'flex-start' }}
              >
                Otevřít
              </Button>
            </Stack>
          </Paper>
        </Grid>

        {/* 2) Moderátoři */}
        <Grid item xs={12} sm={6} md={4}>
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, height: '100%' }}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <PeopleIcon />
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Moderátoři
                </Typography>
              </Stack>
              <Typography color="text.secondary">
                Přidávat/mazat moderátory a resetovat hesla.
              </Typography>
              <Button
                component={RouterLink}
                to="/admin/moderators"
                variant="contained"
                size="small"
                sx={{ alignSelf: 'flex-start' }}
              >
                Otevřít
              </Button>
            </Stack>
          </Paper>
        </Grid>

        {/* 3) Zvířata a příspěvky ke schválení */}
        <Grid item xs={12} sm={6} md={4}>
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, height: '100%' }}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <DescriptionIcon />
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Zvířata a příspěvky ke schválení
                </Typography>
              </Stack>
              <Typography color="text.secondary">
                Přehled zvířat a příspěvků, které čekají na schválení moderátorem nebo administrátorem.
              </Typography>
              <Button
                component={RouterLink}
                to="/moderator/animals?tab=pending"
                variant="contained"
                size="small"
                sx={{ alignSelf: 'flex-start' }}
              >
                Otevřít
              </Button>
            </Stack>
          </Paper>
        </Grid>

        {/* 4) Daňové údaje (token email link form) */}
        <Grid item xs={12} sm={6} md={4}>
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, height: '100%' }}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <RequestQuoteIcon />
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Daňové údaje
                </Typography>
              </Stack>
              <Typography color="text.secondary">
                Odeslat e-mail s odkazem pro doplnění údajů pro potvrzení o daru.
              </Typography>
              <Button
                component={RouterLink}
                to="/admin/tax"
                variant="contained"
                size="small"
                sx={{ alignSelf: 'flex-start' }}
              >
                Otevřít
              </Button>
            </Stack>
          </Paper>
        </Grid>

        {/* ✅ NEW 5) Tax certificates (PDF send) */}
        <Grid item xs={12} sm={6} md={4}>
          <Paper
            variant="outlined"
            sx={{ p: 3, borderRadius: 3, height: '100%' }}
          >
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <MarkEmailUnreadIcon />
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Potvrzení o daru (PDF)
                </Typography>
              </Stack>

              <Typography color="text.secondary">
                Vygeneruje PDF potvrzení a odešle e-mailem všem uživatelům,
                kteří vyplnili daňové údaje.
              </Typography>

              <Button
                onClick={openTax}
                variant="contained"
                size="small"
                sx={{ alignSelf: 'flex-start' }}
              >
                Spustit
              </Button>
            </Stack>
          </Paper>
        </Grid>

        {/* 6) Galerie (placeholder) */}
        <Grid item xs={12} sm={6} md={4}>
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, height: '100%' }}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <PhotoLibraryIcon />
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Galerie
                </Typography>
              </Stack>
              <Typography color="text.secondary">
                Soubory a obrázky ke zvířatům.
              </Typography>
              <Button disabled size="small" variant="outlined" sx={{ alignSelf: 'flex-start' }}>
                Brzy
              </Button>
            </Stack>
          </Paper>
        </Grid>

        {/* 7) Statistiky */}
        <Grid item xs={12} sm={6} md={4}>
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, height: '100%' }}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <BarChartIcon />
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Statistiky
                </Typography>
              </Stack>
              <Typography color="text.secondary">
                Přehled (KPI) + detaily plateb, příslibů a očekávaných příjmů.
              </Typography>
              <Button
                component={RouterLink}
                to="/admin/statistiky"
                variant="contained"
                size="small"
                sx={{ alignSelf: 'flex-start' }}
              >
                Otevřít
              </Button>
            </Stack>
          </Paper>
        </Grid>

        {/* 8) Adopce (placeholder) */}
        <Grid item xs={12} sm={6} md={4}>
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, height: '100%' }}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <DescriptionIcon />
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Adopce
                </Typography>
              </Stack>
              <Typography color="text.secondary">
                Správa žádostí o adopci.
              </Typography>
              <Button disabled size="small" variant="outlined" sx={{ alignSelf: 'flex-start' }}>
                Brzy
              </Button>
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      {/* ──────────────────────────────────────────────
          Dialog: Tax certificates (dry-run + send)
         ────────────────────────────────────────────── */}
      <Dialog open={taxOpen} onClose={() => setTaxOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Odeslat potvrzení o daru (PDF)</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {taxErr && <Alert severity="error">{taxErr}</Alert>}
            {taxOk && <Alert severity="success">{taxOk}</Alert>}

            <TextField
              label="Rok"
              type="number"
              value={taxYear}
              onChange={(e) => setTaxYear(Number(e.target.value))}
              fullWidth
              inputProps={{ min: 2000, max: 2100 }}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={taxIncludePledges}
                  onChange={(e) => setTaxIncludePledges(e.target.checked)}
                />
              }
              label="Zahrnout i Pledge platby (podle e-mailu)"
            />

            <TextField
              label="Limit pro dry-run (bezpečné testování)"
              type="number"
              value={taxLimit}
              onChange={(e) => setTaxLimit(Number(e.target.value))}
              fullWidth
              inputProps={{ min: 1, max: 500 }}
              helperText="Dry-run vrátí jen vzorek a souhrn. Pro ostré odeslání limit nepoužívej."
            />

            <Divider />

            {taxDryRunResult?.summary ? (
              <Box>
                <Typography sx={{ fontWeight: 800, mb: 1 }}>Souhrn</Typography>
                <Typography color="text.secondary" variant="body2">
                  Příjemci: <strong>{taxDryRunResult.summary.recipients ?? 0}</strong> •
                  Celkem CZK: <strong>{taxDryRunResult.summary.totalCzk ?? 0}</strong> •
                  Rok: <strong>{taxDryRunResult.summary.year}</strong>
                </Typography>

                {Array.isArray(taxDryRunResult.sample) && taxDryRunResult.sample.length > 0 ? (
                  <Box sx={{ mt: 1 }}>
                    <Typography sx={{ fontWeight: 700, mb: 0.5 }} variant="body2">
                      Ukázka (max 25):
                    </Typography>
                    <Box sx={{ maxHeight: 220, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1 }}>
                      {taxDryRunResult.sample.map((r: any, idx: number) => (
                        <Typography key={idx} variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {r.email} — {r.totalCzk} Kč — {r.items} plateb
                        </Typography>
                      ))}
                    </Box>
                  </Box>
                ) : null}
              </Box>
            ) : (
              <Typography color="text.secondary" variant="body2">
                Doporučení: nejdřív dej <strong>Dry-run</strong>, zkontroluj počty a pak teprve <strong>Odeslat</strong>.
              </Typography>
            )}
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setTaxOpen(false)} disabled={taxLoading}>
            Zavřít
          </Button>

          <Button
            variant="outlined"
            onClick={doDryRun}
            disabled={taxLoading}
          >
            Dry-run
          </Button>

          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              if (!confirm('Opravdu odeslat PDF potvrzení všem příjemcům?')) return
              doSendNow()
            }}
            disabled={taxLoading}
          >
            Odeslat teď
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}