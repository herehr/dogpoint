import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams, Link as RouterLink } from 'react-router-dom'
import {
  Container,
  Typography,
  Paper,
  Stack,
  TextField,
  Button,
  Alert,
  Divider,
  FormControlLabel,
  Switch,
} from '@mui/material'
import { getTaxTokenInfo, submitTaxToken } from '../api'

type FormState = {
  isCompany: boolean
  companyName: string
  taxId: string

  firstName: string
  lastName: string
  street: string
  streetNo: string
  zip: string
  city: string
}

function asStr(v: any): string {
  return (v ?? '').toString()
}

export default function TaxFormPage() {
  const [params] = useSearchParams()
  const token = params.get('token')?.trim() || ''

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)

  const [form, setForm] = useState<FormState>({
    isCompany: false,
    companyName: '',
    taxId: '',
    firstName: '',
    lastName: '',
    street: '',
    streetNo: '',
    zip: '',
    city: '',
  })

  const tokenMissing = useMemo(() => !token, [token])

  useEffect(() => {
    let alive = true

    async function load() {
      setLoading(true)
      setError(null)
      setOk(null)

      if (!token) {
        setLoading(false)
        setError('Chybí token v URL. Otevřete prosím odkaz z e-mailu.')
        return
      }

      try {
        const data = await getTaxTokenInfo(token)

        if (!alive) return

        setExpiresAt(data?.expiresAt || null)
        setEmail(data?.user?.email || null)

        // Prefill priority:
        // 1) taxProfile (already saved)
        // 2) defaults from User (firstName/lastName/address)
        const defaults = data?.defaults || {}
        const profile = data?.taxProfile || {}

        setForm({
          isCompany: Boolean(profile?.isCompany ?? false),
          companyName: asStr(profile?.companyName ?? ''),
          taxId: asStr(profile?.taxId ?? ''),

          firstName: asStr(profile?.firstName ?? defaults?.firstName ?? ''),
          lastName: asStr(profile?.lastName ?? defaults?.lastName ?? ''),
          street: asStr(profile?.street ?? defaults?.street ?? ''),
          streetNo: asStr(profile?.streetNo ?? defaults?.streetNo ?? ''),
          zip: asStr(profile?.zip ?? defaults?.zip ?? ''),
          city: asStr(profile?.city ?? defaults?.city ?? ''),
        })
      } catch (e: any) {
        if (!alive) return
        const msg = e?.message || 'Nepodařilo se načíst formulář.'
        setError(msg)
      } finally {
        if (alive) setLoading(false)
      }
    }

    load()
    return () => {
      alive = false
    }
  }, [token])

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function validate(): string | null {
    // Minimal validation
    if (form.isCompany) {
      if (!form.companyName.trim()) return 'Vyplňte název firmy.'
      // taxId is optional, depends on your preference
    } else {
      if (!form.firstName.trim()) return 'Vyplňte jméno.'
      if (!form.lastName.trim()) return 'Vyplňte příjmení.'
    }

    if (!form.street.trim()) return 'Vyplňte ulici.'
    if (!form.streetNo.trim()) return 'Vyplňte číslo popisné.'
    if (!form.zip.trim()) return 'Vyplňte PSČ.'
    if (!form.city.trim()) return 'Vyplňte město.'

    return null
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setOk(null)

    if (!token) {
      setError('Chybí token v URL.')
      return
    }

    const v = validate()
    if (v) {
      setError(v)
      return
    }

    setSubmitting(true)
    try {
      await submitTaxToken(token, {
        isCompany: form.isCompany,
        companyName: form.companyName.trim(),
        taxId: form.taxId.trim(),

        // If company: firstName/lastName can be empty; backend accepts nulls.
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),

        street: form.street.trim(),
        streetNo: form.streetNo.trim(),
        zip: form.zip.trim(),
        city: form.city.trim(),
      })

      setOk('Děkujeme! Údaje byly uloženy.')
    } catch (e: any) {
      setError(e?.message || 'Odeslání se nepodařilo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Typography variant="h5" sx={{ fontWeight: 900, mb: 1 }}>
        Údaje pro potvrzení o daru
      </Typography>

      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        Vyplňte prosím údaje pro vystavení potvrzení o daru. Odkaz je jednorázový.
      </Typography>

      {tokenMissing && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Chybí token v URL. Otevřete prosím odkaz z e-mailu.
        </Alert>
      )}

      {email && (
        <Alert severity="info" sx={{ mb: 2 }}>
          E-mail účtu: <strong>{email}</strong>
          {expiresAt ? (
            <>
              <br />
              Platnost odkazu do: <strong>{new Date(expiresAt).toLocaleString()}</strong>
            </>
          ) : null}
        </Alert>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {ok && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {ok}
          <br />
          <Button
            component={RouterLink}
            to="/"
            variant="text"
            sx={{ mt: 1, px: 0 }}
          >
            Zpět na hlavní stránku
          </Button>
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
        <form onSubmit={onSubmit}>
          <Stack spacing={2.2}>
            <FormControlLabel
              control={
                <Switch
                  checked={form.isCompany}
                  onChange={(e) => setField('isCompany', e.target.checked)}
                />
              }
              label={form.isCompany ? 'Vyplňuji údaje jako firma' : 'Vyplňuji údaje jako fyzická osoba'}
            />

            <Divider />

            {form.isCompany ? (
              <>
                <TextField
                  label="Název firmy"
                  value={form.companyName}
                  onChange={(e) => setField('companyName', e.target.value)}
                  fullWidth
                  required
                />
                <TextField
                  label="IČ / DIČ (volitelné)"
                  value={form.taxId}
                  onChange={(e) => setField('taxId', e.target.value)}
                  fullWidth
                />
              </>
            ) : (
              <>
                <TextField
                  label="Jméno"
                  value={form.firstName}
                  onChange={(e) => setField('firstName', e.target.value)}
                  fullWidth
                  required
                />
                <TextField
                  label="Příjmení"
                  value={form.lastName}
                  onChange={(e) => setField('lastName', e.target.value)}
                  fullWidth
                  required
                />
              </>
            )}

            <Divider />

            <TextField
              label="Ulice"
              value={form.street}
              onChange={(e) => setField('street', e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="Číslo popisné"
              value={form.streetNo}
              onChange={(e) => setField('streetNo', e.target.value)}
              fullWidth
              required
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="PSČ"
                value={form.zip}
                onChange={(e) => setField('zip', e.target.value)}
                fullWidth
                required
              />
              <TextField
                label="Město"
                value={form.city}
                onChange={(e) => setField('city', e.target.value)}
                fullWidth
                required
              />
            </Stack>

            <Button
              type="submit"
              variant="contained"
              disabled={loading || submitting || !!ok || tokenMissing}
              sx={{ py: 1.2, fontWeight: 900, borderRadius: 2 }}
            >
              {submitting ? 'Odesílám…' : 'Uložit údaje'}
            </Button>

            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Pokud vám odkaz nefunguje nebo vypršel, požádejte prosím o nový.
            </Typography>
          </Stack>
        </form>
      </Paper>
    </Container>
  )
}