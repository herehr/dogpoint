// frontend/src/pages/AnimalsManager.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Container, Typography, Paper, Stack, Button, TextField, Checkbox, FormControlLabel,
  Grid, Card, CardMedia, CardContent, CardActions, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, Alert, Box, LinearProgress, Tooltip, Chip
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import UploadIcon from '@mui/icons-material/UploadFile'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import LogoutIcon from '@mui/icons-material/Logout'
import { useNavigate } from 'react-router-dom'

import {
  fetchAnimals, type Animal, createAnimal, updateAnimal, deleteAnimal,
  uploadMediaMany, logout as apiLogout
} from '../services/api'

type FormAnimal = {
  id?: string
  jmeno?: string
  popis?: string
  active?: boolean
  main?: string | null
  galerie?: { url: string }[]
}

export default function AnimalsManager() {
  const [rows, setRows] = useState<Animal[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  // Dialog state
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormAnimal>({
    jmeno: '', popis: '', active: true, galerie: [], main: null
  })
  const isEdit = useMemo(() => !!form.id, [form.id])

  // Upload state (dialog)
  const [uploading, setUploading] = useState(false)
  const [uploadNote, setUploadNote] = useState<string>('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const navigate = useNavigate()

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

  function onLogout() {
    apiLogout()
    navigate('/', { replace: true })
  }

  function newAnimal() {
    setForm({ jmeno: '', popis: '', active: true, galerie: [], main: null })
    setOpen(true)
  }

  function editAnimal(a: Animal) {
    const gallery = (a.galerie || []).map(g => ({ url: g.url }))
    const main = (a as any).main || gallery[0]?.url || null
    setForm({
      id: a.id,
      jmeno: a.jmeno || a.name || '',
      popis: a.popis || a.description || '',
      active: a.active ?? true,
      galerie: gallery,
      main
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
      // ensure main is part of gallery if there is gallery
      let main = form.main || null
      if (!main && cleanGallery.length) main = cleanGallery[0].url

      const payload: any = {
        jmeno: form.jmeno?.trim(),
        popis: form.popis?.trim(),
        active: !!form.active,
        main,
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
      const now = Date.now()
      setForm(f => {
        const newGallery = [
          ...(f.galerie || []),
          ...urls.map(raw => ({ url: `${raw}${raw.includes('?') ? '&' : '?'}v=${now}` }))
        ]
        // if no main picked yet, set to first newly added
        const cleanMain = f.main || (urls[0] ? `${urls[0]}${urls[0].includes('?') ? '&' : '?'}v=${now}` : null)
        return { ...f, galerie: newGallery, main: cleanMain }
      })
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
    setForm(f => {
      const next = { ...(f.galerie || []), { url } }
      const newMain = f.main || url
      return { ...f, galerie: next, main: newMain }
    })
  }

  function removeGalleryIndex(i: number) {
    setForm(f => {
      const list = (f.galerie || []).filter((_, idx) => idx !== i)
      const removedUrl = (f.galerie || [])[i]?.url
      let newMain = f.main || null
      if (removedUrl && f.main === removedUrl) {
        newMain = list[0]?.url || null
      }
      return { ...f, galerie: list, main: newMain }
    })
  }

  function setMain(url: string) {
    setForm(f => ({ ...f, main: url }))
  }

  /* ---------- Render ---------- */

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems="center" justifyContent="space-between" sx={{ mb: 2 }} spacing={1}>
        <Typography variant="h5" sx={{ fontWeight: 900 }}>Zvířata – správa</Typography>
        <Stack direction="row" spacing={1}>
          <Button onClick={newAnimal} variant="contained" startIcon={<AddIcon />}>Přidat zvíře</Button>
          <Button onClick={onLogout} variant="text" startIcon={<LogoutIcon />}>Odhlásit</Button>
        </Stack>
      </Stack>

      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
      {ok && <Alert severity="success" sx={{ mb: 2 }}>{ok}</Alert>}

      <Grid container spacing={2}>
        {rows.map(a => {
          const main = (a as any).main || a.galerie?.[0]?.url || '/no-image.jpg'
          const isActive = a.active !== false
          return (
            <Grid item xs={12} sm={6} md={4} lg={3} key={a.id}>
              <Card variant="outlined" sx={{ borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                {!isActive && (
                  <Chip
                    label="NEAKTIVNÍ"
                    color="default"
                    size="small"
                    sx={{ position: 'absolute', top: 8, left: 8, bgcolor: 'warning.light', color: '#000' }}
                  />
                )}
                <CardMedia component="img" image={main} alt={a.jmeno || 'Zvíře'} sx={{ height: 160, objectFit: 'cover' }} />
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                    {a.jmeno || a.name || '—'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {isActive ? 'Aktivní' : 'Neaktivní'}
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
                  <Button onClick={() => fileInputRef.current?.click()} startIcon={<UploadIcon />} variant="outlined">
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

                  <Button onClick={() => cameraInputRef.current?.click()} startIcon={<PhotoCameraIcon />} variant="outlined">
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
                        const input = e.currentTarget as HTMLInputElement
                        addUrl(input.value)
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

                {/* Thumbnails grid with MAIN selector */}
                <Grid container spacing={1.5} sx={{ mt: 1 }}>
                  {(form.galerie || []).map((g, i) => {
                    const url = g.url
                    const isMain = !!form.main && stripCache(form.main) === stripCache(url)
                    return (
                      <Grid item xs={6} sm={4} md={3} key={`${url}-${i}`}>
                        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
                          <Box sx={{ position: 'relative', width: '100%', height: 120, bgcolor: '#f7f7f7' }}>
                            <img
                              src={url}
                              alt={`media-${i}`}
                              style={{ width: '100%', height: '120px', objectFit: 'cover', display: 'block' }}
                              onError={(ev) => { (ev.currentTarget as HTMLImageElement).style.opacity = '0.35' }}
                            />
                            <Tooltip title={isMain ? 'Hlavní fotografie' : 'Nastavit jako hlavní'}>
                              <IconButton
                                size="small"
                                onClick={() => setMain(url)}
                                sx={{
                                  position: 'absolute',
                                  top: 6,
                                  right: 6,
                                  bgcolor: 'rgba(255,255,255,0.9)'
                                }}
                              >
                                {isMain ? <StarIcon fontSize="small" color="warning" /> : <StarBorderIcon fontSize="small" />}
                              </IconButton>
                            </Tooltip>
                          </Box>
                          <Stack direction="row" spacing={1} sx={{ p: 1 }}>
                            <Button component="a" href={url} target="_blank" rel="noreferrer" size="small">Otevřít</Button>
                            <Button color="error" onClick={() => removeGalleryIndex(i)} size="small">Odebrat</Button>
                          </Stack>
                        </Box>
                      </Grid>
                    )
                  })}
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

/* Utility: compare URLs without cache-buster */
function stripCache(url?: string | null): string {
  if (!url) return ''
  const [u] = url.split('?')
  return u
}