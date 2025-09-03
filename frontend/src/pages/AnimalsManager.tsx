// frontend/src/pages/AnimalsManager.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Container, Typography, Paper, Stack, Button, TextField, Checkbox, FormControlLabel,
  Table, TableHead, TableRow, TableCell, TableBody, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, Alert, Box, LinearProgress
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import UploadIcon from '@mui/icons-material/UploadFile'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'

import {
  fetchAnimals, type Animal,
  createAnimal, updateAnimal, deleteAnimal,
  uploadMedia, uploadMediaMany
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

  // Upload state
  const [uploading, setUploading] = useState(false)
  const [uploadNote, setUploadNote] = useState<string>('') // “Nahrávám 2/3…”
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

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
        // Czech key used by your UI:
       galerie: cleanGallery,
        // English key for compatibility with some backends:
    gallery: cleanGallery,
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

  /* ---------- Upload helpers ---------- */

  async function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter(f => f && f.size > 0)
    if (arr.length === 0) return
    setUploading(true)
    setErr(null)
    try {
      // batch upload with progress updates
      const urls = await uploadMediaMany(arr, (index, total) => {
  setUploadNote(`Nahrávám ${index + 1} / ${total}…`)
})
// add cache-buster to preview; save without it later
const now = Date.now()
setForm(f => ({
  ...f,
  galerie: [
    ...(f.galerie || []),
    ...urls.map(raw => ({ url: `${raw}${raw.includes('?') ? '&' : '?'}v=${now}` }))
  ]
}))
      setOk('Soubor(y) nahrány')
    } catch (e: any) {
      setErr(e?.message || 'Nahrání selhalo')
    } finally {
      setUploading(false)
      setUploadNote('')
    }
  }

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) handleFiles(e.target.files)
    e.target.value = ''
  }

  function onPickCamera(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) handleFiles(e.target.files)
    e.target.value = ''
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    const files = e.dataTransfer?.files
    if (files && files.length) handleFiles(files)
  }

  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
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

      <Paper variant="outlined" sx={{ p: 0, borderRadius: 3, mb: 3 }}>
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

              {/* Galerie uploader */}
              <Stack spacing={1}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Galerie</Typography>

                {/* Controls */}
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    startIcon={<UploadIcon />}
                    variant="outlined"
                  >
                    Vybrat soubory
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    hidden
                    multiple
                    accept="image/*,video/*"
                    onChange={onPickFiles}
                  />

                  <Button
                    onClick={() => cameraInputRef.current?.click()}
                    startIcon={<PhotoCameraIcon />}
                    variant="outlined"
                  >
                    Vyfotit (telefon)
                  </Button>
                  <input
                    ref={cameraInputRef}
                    type="file"
                    hidden
                    // Most mobile browsers will open the camera with capture attr:
                    accept="image/*"
                    capture="environment"
                    onChange={onPickCamera}
                  />

                  <TextField
                    label="Přidat URL obrázku (Enter)"
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

                {/* Drag & Drop area */}
                <Box
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  sx={{
                    mt: 1,
                    p: 2,
                    border: '2px dashed',
                    borderColor: 'divider',
                    borderRadius: 2,
                    textAlign: 'center',
                    color: 'text.secondary',
                    cursor: 'copy',
                    userSelect: 'none'
                  }}
                >
                  Přetáhněte sem fotografie nebo videa
                </Box>

                {uploading && (
                  <Stack spacing={1} sx={{ mt: 1 }}>
                    <LinearProgress />
                    <Typography variant="caption" color="text.secondary">{uploadNote}</Typography>
                  </Stack>
                )}

                {/* Existing URLs list (editable) */}
                <Stack spacing={1}>
  {(form.galerie || []).map((g, i) => (
    <Stack key={i} direction="row" spacing={1} alignItems="center">
      <img
        src={(g.url || '').trim() ? g.url : '/no-image.jpg'}
        alt="náhled"
        style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid #eee' }}
        onError={(ev) => {
          // mark broken preview
          (ev.currentTarget as HTMLImageElement).style.opacity = '0.3'
        }}
      />
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
      <Button component="a" href={g.url} target="_blank" rel="noreferrer" size="small">Otevřít</Button>
      <Button color="error" onClick={() => removeGalleryIndex(i)} size="small">Odebrat</Button>
    </Stack>
  ))}
</Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Zrušit</Button>
            <Button type="submit" variant="contained" disabled={loading || uploading}>
              {isEdit ? 'Uložit změny' : 'Vytvořit'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Container>
  )
}