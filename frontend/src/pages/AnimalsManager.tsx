// frontend/src/pages/AnimalsManager.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Container, Typography, Paper, Stack, Button, TextField, Checkbox, FormControlLabel,
  Grid, Card, CardMedia, CardContent, CardActions, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, Alert, Box, LinearProgress
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import UploadIcon from '@mui/icons-material/UploadFile'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'

import {
  fetchAnimals, type Animal, createAnimal, updateAnimal, deleteAnimal,
  uploadMediaMany
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

  // Upload state (dialog)
  const [uploading, setUploading] = useState(false)
  const [uploadNote, setUploadNote] = useState<string>('')
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
        galerie: cleanGallery
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

  /* ---------- Upload helpers (dialog) ---------- */

  async function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter(f => f && f.size > 0)
    if (arr.length === 0) return
    setUploading(true)
    setErr(null)
    try {
      const urls = await uploadMediaMany(arr, (index, total) => {
        setUploadNote(`Nahrávám ${index + 1} / ${total}…`)
      })
      // show immediately; save as clean URLs on submit
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

  function addUrl(v: string) {
    const url = v.trim()
    if (!url) return
    setForm(f => ({ ...f, galerie: [...(f.galerie || []), { url }] }))
  }

  function removeGalleryIndex(i: number) {
    setForm(f => ({ ...f, galerie: (f.galerie || []).filter((_, idx) => idx !== i) }))
  }

  /* ---------- Render ---------- */

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
          const main = (a as any).main || a.galerie?.[0]?.url || '/no-image.jpg'
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

      {/* Create/Edit dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{isEdit ? 'Upravit zvíře' : 'Přidat zvíře'}</DialogTitle>
        <form onSubmit={onSubmit}>
          <DialogContent>
            <Stack spacing={3}>
              {/* Basic fields */}
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
              </Stack>

              {/* Uploader controls */}
              <Stack spacing={1}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Galerie</Typography>

                {/* Buttons: files + camera + add by URL */}
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
                    accept="image/*"
                    capture="environment"
                    onChange={onPickCamera}
                  />

                  <TextField
                    label="Přidat URL (Enter)"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        // @ts-expect-error value exists on HTMLInputElement
                        const v = (e.currentTarget as HTMLInputElement).value
                        addUrl(v)
                        ;(e.currentTarget as HTMLInputElement).value = ''
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

                {/* Thumbnails grid */}
                <Grid container spacing={1.5} sx={{ mt: 1 }}>
                  {(form.galerie || []).map((g, i) => (
                    <Grid item xs={6} sm={4} md={3} key={`${g.url}-${i}`}>
                      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                        <Box sx={{ position: 'relative', width: '100%', height: 120, bgColor: '#f7f7f7' }}>
                          <img
                            src={g.url}
                            alt={`media-${i}`}
                            style={{ width: '100%', height: '120px', objectFit: 'cover', display: 'block' }}
                            onError={(ev) => { (ev.currentTarget as HTMLImageElement).style.opacity = '0.35' }}
                          />
                        </Box>
                        <Stack direction="row" spacing={1} sx={{ p: 1 }}>
                          <Button
                            component="a"
                            href={g.url}
                            target="_blank"
                            rel="noreferrer"
                            size="small"
                          >
                            Otevřít
                          </Button>
                          <Button
                            color="error"
                            onClick={() => removeGalleryIndex(i)}
                            size="small"
                          >
                            Odebrat
                          </Button>
                        </Stack>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Stack>
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