// frontend/src/pages/AnimalsManager.tsx
import React, { useEffect, useMemo, useState } from 'react'
import {
  Container, Typography, Paper, Stack, Button, TextField, Checkbox, FormControlLabel,
  Table, TableHead, TableRow, TableCell, TableBody, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, Alert
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import UploadIcon from '@mui/icons-material/UploadFile'

import {
  fetchAnimals, type Animal,
  createAnimal, updateAnimal, deleteAnimal, uploadMedia
} from '../services/api'

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
      const payload = {
        jmeno: form.jmeno?.trim(),
        popis: form.popis?.trim(),
        active: !!form.active,
        galerie: (form.galerie || []).filter(x => x.url.trim() !== ''),
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

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const { url } = await uploadMedia(file)
      setForm(f => ({ ...f, galerie: [...(f.galerie || []), { url }] }))
    } catch (e: any) {
      setErr(e?.message || 'Nahrání selhalo')
    } finally {
      e.target.value = ''
    }
  }

  function removeGalleryIndex(i: number) {
    setForm(f => ({ ...f, galerie: (f.galerie || []).filter((_, idx) => idx !== i) }))
  }

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 900 }}>Zvířata – správa</Typography>
        <Button onClick={newAnimal} variant="contained" startIcon={<AddIcon />}>Přidat zvíře</Button>
      </Stack>

      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
      {ok && <Alert severity="success" sx={{ mb: 2 }}>{ok}</Alert>}

      <Paper variant="outlined" sx={{ p: 0, borderRadius: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Jméno</TableCell>
              <TableCell>Popis</TableCell>
              <TableCell>Aktivní</TableCell>
              <TableCell>Obrázků</TableCell>
              <TableCell align="right">Akce</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map(a => (
              <TableRow key={a.id} hover>
                <TableCell>{a.jmeno || a.name || '—'}</TableCell>
                <TableCell sx={{ maxWidth: 420 }} title={a.popis || a.description || ''}>
                  {(a.popis || a.description || '—').slice(0, 80)}{(a.popis || a.description || '').length > 80 ? '…' : ''}
                </TableCell>
                <TableCell>{a.active ? 'Ano' : 'Ne'}</TableCell>
                <TableCell>{a.galerie?.length || 0}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => editAnimal(a)} title="Upravit"><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" color="error" onClick={() => removeAnimal(a.id)} title="Smazat"><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  Zatím žádná zvířata
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* Create/Edit dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{isEdit ? 'Upravit zvíře' : 'Přidat zvíře'}</DialogTitle>
        <form onSubmit={onSubmit}>
          <DialogContent>
            <Stack spacing={2}>
              <TextField
                label="Jméno"
                value={form.jmeno || ''}
                onChange={(e) => setForm(f => ({ ...f, jmeno: e.target.value }))}
                required
                fullWidth
              />
              <TextField
                label="Popis"
                value={form.popis || ''}
                onChange={(e) => setForm(f => ({ ...f, popis: e.target.value }))}
                multiline minRows={3}
                fullWidth
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={!!form.active}
                    onChange={(e) => setForm(f => ({ ...f, active: e.target.checked }))}
                  />
                }
                label="Aktivní (zobrazit na webu)"
              />

              {/* Galerie URLs */}
              <Stack spacing={1}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Galerie</Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                  <Button component="label" startIcon={<UploadIcon />} variant="outlined">
                    Nahrát soubor
                    <input type="file" hidden accept="image/*,video/*" onChange={onUpload} />
                  </Button>
                  <TextField
                    label="Přidat URL obrázku (vložením)"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const input = e.currentTarget as HTMLInputElement
                        const v = input.value.trim()
                        if (!v) return
                        setForm(f => ({ ...f, galerie: [...(f.galerie || []), { url: v }] }))
                        input.value = ''
                      }
                    }}
                    placeholder="https://…/obrazek.jpg"
                    fullWidth
                  />
                </Stack>
                <Stack spacing={1}>
                  {(form.galerie || []).map((g, i) => (
                    <Stack key={i} direction="row" spacing={1} alignItems="center">
                      <TextField
                        size="small"
                        value={g.url}
                        onChange={(e) => {
                          const v = e.target.value
                          setForm(f => {
                            const copy = [...(f.galerie || [])]
                            copy[i] = { url: v }
                            return { ...f, galerie: copy }
                          })
                        }}
                        fullWidth
                      />
                      <Button color="error" onClick={() => removeGalleryIndex(i)} size="small">Odebrat</Button>
                    </Stack>
                  ))}
                </Stack>
              </Stack>
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