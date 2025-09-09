// frontend/src/pages/AnimalsManager.tsx
import React, { useEffect, useMemo, useState } from 'react'
import {
  Container, Typography, Paper, Stack, Button, TextField, Checkbox, FormControlLabel,
  Grid, Card, CardMedia, CardContent, CardActions, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, Alert
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import UploadIcon from '@mui/icons-material/UploadFile'
import { fetchAnimals, type Animal, createAnimal, updateAnimal, deleteAnimal, uploadMedia, uploadMediaMany } from '../services/api'

type FormAnimal = {
  id?: string
  jmeno?: string
  popis?: string
  active?: boolean
  galerie?: { url: string }[]
}

export default function AnimalsManager() {
  const [rows, setRows] = useState<Animal[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  // Dialog state
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormAnimal>({ jmeno: '', popis: '', active: true, galerie: [] })
  const isEdit = useMemo(() => !!form.id, [form.id])

  async function refresh() {
    setErr(null)
    try {
      const list = await fetchAnimals()
      setRows(list)
    } catch (e: any) {
      setErr(e?.message || 'Chyba načítání seznamu zvířat')
    }
  }

  useEffect(() => { refresh() }, [])

  function newAnimal() {
    setForm({ jmeno: '', popis: '', active: true, galerie: [] })
    setOpen(true)
  }

  function editAnimal(a: Animal) {
    setForm({
      id: a.id,
      jmeno: a.jmeno || a.name || '',
      popis: a.popis || a.description || '',
      active: a.active ?? true,
      galerie: (a.galerie || []).map(g => ({ url: g.url }))
    })
    setOpen(true)
  }

  async function removeAnimal(id: string) {
    if (!confirm('Opravdu smazat toto zvíře?')) return
    setErr(null); setOk(null)
    try {
      await deleteAnimal(id)
      setOk('Záznam smazán')
      await refresh()
    } catch (e: any) {
      setErr(e?.message || 'Smazání selhalo')
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null); setOk(null); setLoading(true)
    try {
      const cleanGallery = (form.galerie || []).filter(x => (x.url || '').trim() !== '')
      const payload: any = {
        jmeno: form.jmeno?.trim(),
        popis: form.popis?.trim(),
        active: !!form.active,
        galerie: cleanGallery,
      }
      if (isEdit && form.id) {
        await updateAnimal(form.id, payload)
        setOk('Záznam upraven')
      } else {
        await createAnimal(payload)
        setOk('Záznam vytvořen')
      }
      setOpen(false)
      await refresh()
    } catch (e: any) {
      setErr(e?.message || 'Uložení selhalo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 900 }}>Zvířata – správa</Typography>
        <Button onClick={newAnimal} variant="contained" startIcon={<AddIcon />}>Přidat zvíře</Button>
      </Stack>

      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
      {ok && <Alert severity="success" sx={{ mb: 2 }}>{ok}</Alert>}

      <Grid container spacing={2}>
        {rows.map(a => {
          const main = a.main || a.galerie?.[0]?.url || '/no-image.jpg'
          return (
            <Grid item xs={12} sm={6} md={4} lg={3} key={a.id}>
              <Card variant="outlined" sx={{ borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardMedia component="img" image={main} alt={a.jmeno || 'Zvíře'} sx={{ height: 160, objectFit: 'cover' }} />
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                    {a.jmeno || a.name || '—'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {a.active ? 'Aktivní' : 'Neaktivní'}
                  </Typography>
                </CardContent>
                <CardActions sx={{ justifyContent: 'space-between' }}>
                  <IconButton size="small" onClick={() => editAnimal(a)} title="Upravit"><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" color="error" onClick={() => removeAnimal(a.id)} title="Smazat"><DeleteIcon fontSize="small" /></IconButton>
                </CardActions>
              </Card>
            </Grid>
          )
        })}
        {rows.length === 0 && (
          <Grid item xs={12}>
            <Paper variant="outlined" sx={{ p: 4, borderRadius: 3, textAlign: 'center' }}>
              Zatím žádná zvířata
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* Create/Edit dialog (same as before) */}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{isEdit ? 'Upravit zvíře' : 'Přidat zvíře'}</DialogTitle>
        <form onSubmit={onSubmit}>
          <DialogContent>
            <Stack spacing={2}>
              <TextField label="Jméno" value={form.jmeno || ''} onChange={(e) => setForm(f => ({ ...f, jmeno: e.target.value }))} required fullWidth />
              <TextField label="Popis" value={form.popis || ''} onChange={(e) => setForm(f => ({ ...f, popis: e.target.value }))} multiline minRows={3} fullWidth />
              <FormControlLabel control={<Checkbox checked={!!form.active} onChange={(e) => setForm(f => ({ ...f, active: e.target.checked }))} />} label="Aktivní (zobrazit na webu)" />
              {/* (Keep your gallery controls as in your current dialog) */}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Zrušit</Button>
            <Button type="submit" variant="contained" disabled={loading}>
              {isEdit ? 'Uložit změny' : 'Vytvořit'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Container>
  )
}