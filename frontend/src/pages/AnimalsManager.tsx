// frontend/src/pages/AnimalsManager.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Container,
  Typography,
  Paper,
  Stack,
  Button,
  TextField,
  Checkbox,
  FormControlLabel,
  Grid,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Box,
  LinearProgress,
  Tooltip,
  Chip,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import UploadIcon from '@mui/icons-material/UploadFile'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import LogoutIcon from '@mui/icons-material/Logout'
import PostAddIcon from '@mui/icons-material/PostAdd'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { useNavigate } from 'react-router-dom'
import RichTextEditor from '../components/RichTextEditor'

import {
  fetchAnimals,
  type Animal,
  createAnimal,
  updateAnimal,
  deleteAnimal,
  uploadMedia,
  createPost,
} from '../api'
import { useAuth } from '../context/AuthContext'

type FormAnimal = {
  id?: string
  jmeno?: string
  popis?: string
  active?: boolean
  main?: string | null
  // ✅ keep url + typ so we can render videos too
  galerie?: { url: string; typ?: 'image' | 'video'; type?: 'image' | 'video'; poster?: string; posterUrl?: string }[]

  charakteristik?: string
  birthDate?: string // yyyy-mm-dd
  bornYear?: string // string in UI, number on submit
}

type PostMedia = { url: string; type?: 'image' | 'video' }

const EMOJIS = ['🐾', '❤️', '😊', '🥰', '👏', '🎉', '😍', '🤗', '🌟', '👍']

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|m4v|mov)(\?|$)/i.test(url || '')
}
function isVideoMedia(m: { url?: string; typ?: string; type?: string }): boolean {
  const t = String(m.typ || m.type || '').toLowerCase()
  if (t.includes('video')) return true
  return isVideoUrl(String(m.url || ''))
}
function guessTypeFromUrl(u: string): 'image' | 'video' | undefined {
  const lc = (u || '').toLowerCase()
  if (/\.(mp4|webm|mov|m4v)(\?|$)/.test(lc)) return 'video'
  if (/\.(jpg|jpeg|png|gif|webp|avif)(\?|$)/.test(lc)) return 'image'
  return undefined
}
function guessVideoMime(url: string): string {
  const u = (url || '').toLowerCase()
  if (u.includes('.webm')) return 'video/webm'
  return 'video/mp4'
}

/* Utility: compare URLs without cache-buster */
function stripCache(url?: string | null): string {
  if (!url) return ''
  const [u] = url.split('?')
  return u
}

// ✅ pick first NON-video as image for cards/main
function firstImageUrlFromGallery(gal?: { url: string; typ?: string; type?: string }[]): string | null {
  const list = gal || []
  const firstImg = list.find((x) => !isVideoMedia(x)) || list[0]
  return firstImg?.url || null
}

export default function AnimalsManager() {
  const [rows, setRows] = useState<Animal[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  // Dialog: animal create/edit
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormAnimal>({
    jmeno: '',
    popis: '',
    active: true,
    galerie: [],
    main: null,
    charakteristik: '',
    birthDate: '',
    bornYear: '',
  })
  const isEdit = useMemo(() => !!form.id, [form.id])

  // Upload state (animal dialog)
  const [uploading, setUploading] = useState(false)
  const [uploadNote, setUploadNote] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const navigate = useNavigate()
  const { logout } = useAuth()

  // Post composer dialog
  const [postOpen, setPostOpen] = useState(false)
  const [postAnimalId, setPostAnimalId] = useState<string | null>(null)
  const [postTitle, setPostTitle] = useState('')
  const [postBody, setPostBody] = useState('')
  const [postMedia, setPostMedia] = useState<PostMedia[]>([])
  const [postSaving, setPostSaving] = useState(false)
  const [postUploading, setPostUploading] = useState(false)
  const [postUploadNote, setPostUploadNote] = useState('')

  const postFileRef = useRef<HTMLInputElement>(null)
  const postCameraRef = useRef<HTMLInputElement>(null)

  async function refresh() {
    setErr(null)
    try {
      const list = await fetchAnimals()
      setRows(list)
    } catch (e: any) {
      setErr(e?.message || 'Chyba načítání seznamu zvířat')
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  function onLogout() {
    logout()
    navigate('/', { replace: true })
  }

  function newAnimal() {
    setForm({
      jmeno: '',
      popis: '',
      active: true,
      galerie: [],
      main: null,
      charakteristik: '',
      birthDate: '',
      bornYear: '',
    })
    setOpen(true)
  }

  function editAnimal(a: Animal) {
    const rawGallery: any[] = (a as any).galerie || (a as any).gallery || []
    const gallery = rawGallery.map((g: any) => ({
      url: String(g.url || g.key || ''),
      typ: (g.typ || g.type || guessTypeFromUrl(String(g.url || g.key || ''))) as any,
      poster: g.poster || null,
      posterUrl: g.posterUrl || null,
    })).filter((g) => g.url)

    // ✅ main should prefer image (not video)
    const main =
      (a as any).main ||
      firstImageUrlFromGallery(gallery) ||
      (gallery[0]?.url ?? null)

    setForm({
      id: a.id,
      jmeno: (a as any).jmeno || (a as any).name || '',
      popis: (a as any).popis || (a as any).description || '',
      active: (a as any).active ?? true,
      galerie: gallery,
      main,
      charakteristik: (a as any).charakteristik || '',
      birthDate: (a as any).birthDate
        ? new Date((a as any).birthDate).toISOString().slice(0, 10)
        : '',
      bornYear: (a as any).bornYear != null ? String((a as any).bornYear) : '',
    })
    setOpen(true)
  }

  async function removeAnimal(id: string) {
    if (!confirm('Opravdu smazat toto zvíře?')) return
    setErr(null)
    setOk(null)
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
    setErr(null)
    setOk(null)
    setLoading(true)
    try {
      const cleanGallery = (form.galerie || []).filter((x) => (x.url || '').trim() !== '')

      // ✅ main should prefer image
      let main = form.main || null
      if (!main && cleanGallery.length) {
        main = firstImageUrlFromGallery(cleanGallery) || cleanGallery[0].url
      }

      const payload: any = {
        jmeno: form.jmeno?.trim(),
        popis: form.popis?.trim(),
        active: !!form.active,
        main,
        // send galerie with url + typ if available
        galerie: cleanGallery.map((g) => ({
          url: g.url,
          typ: (g.typ || g.type || guessTypeFromUrl(g.url) || 'image'),
          poster: (g as any).poster || undefined,
          posterUrl: (g as any).posterUrl || undefined,
        })),

        charakteristik: form.charakteristik?.trim() || undefined,
        birthDate: form.birthDate ? new Date(form.birthDate).toISOString() : undefined,
        bornYear: !form.birthDate && form.bornYear ? Number(form.bornYear) : undefined,
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

  /* ---------- Upload helpers (animal dialog) ---------- */

  async function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f && f.size > 0)
    if (arr.length === 0) return
    setUploading(true)
    setErr(null)
    try {
      const results: { url: string; typ?: 'image' | 'video' }[] = []
      for (let i = 0; i < arr.length; i++) {
        setUploadNote(`Nahrávám ${i + 1} / ${arr.length}…`)
        // eslint-disable-next-line no-await-in-loop
        const one = await uploadMedia(arr[i]) // { url?, key?, type? }
        const rawUrl = String((one as any)?.url || (one as any)?.key || '')
        if (!rawUrl) continue
        const t = (one as any)?.type || guessTypeFromUrl(rawUrl)
        results.push({ url: rawUrl, typ: (t === 'video' ? 'video' : 'image') })
      }

      const now = Date.now()
      setForm((f) => {
        const newGallery = [
          ...(f.galerie || []),
          ...results.map((r) => ({
            url: `${r.url}${r.url.includes('?') ? '&' : '?'}v=${now}`,
            typ: r.typ || guessTypeFromUrl(r.url) || 'image',
          })),
        ]

        // ✅ main should prefer image
        const computedMain =
          f.main ||
          firstImageUrlFromGallery(newGallery) ||
          newGallery[0]?.url ||
          null

        return { ...f, galerie: newGallery, main: computedMain }
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
    setForm((f) => {
      const next = [...(f.galerie || []), { url, typ: guessTypeFromUrl(url) || 'image' }]
      const newMain =
        f.main ||
        firstImageUrlFromGallery(next) ||
        url
      return { ...f, galerie: next, main: newMain }
    })
  }

  function removeGalleryIndex(i: number) {
    setForm((f) => {
      const list = (f.galerie || []).filter((_, idx) => idx !== i)
      const removedUrl = (f.galerie || [])[i]?.url
      let newMain = f.main || null
      if (removedUrl && stripCache(f.main) === stripCache(removedUrl)) {
        newMain = firstImageUrlFromGallery(list) || list[0]?.url || null
      }
      return { ...f, galerie: list, main: newMain }
    })
  }

  function setMain(url: string) {
    setForm((f) => ({ ...f, main: url }))
  }

  /* ---------- Posts: open composer for an animal ---------- */

  function openPostFor(animalId: string) {
    setPostAnimalId(animalId)
    setPostTitle('')
    setPostBody('')
    setPostMedia([])
    setPostOpen(true)
  }

  function closePost() {
    setPostOpen(false)
    setPostAnimalId(null)
    setPostTitle('')
    setPostBody('')
    setPostMedia([])
    setPostUploading(false)
    setPostUploadNote('')
  }

  function addPostEmoji(emoji: string) {
    setPostBody((prev) => (prev ? prev + ' ' + emoji : emoji))
  }

  async function postHandleFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f && f.size > 0)
    if (arr.length === 0) return
    setPostUploading(true)
    setErr(null)
    try {
      const results: { url: string; typ?: 'image' | 'video' }[] = []
      for (let i = 0; i < arr.length; i++) {
        setPostUploadNote(`Nahrávám ${i + 1} / ${arr.length}…`)
        // eslint-disable-next-line no-await-in-loop
        const one = await uploadMedia(arr[i])
        const rawUrl = String((one as any)?.url || (one as any)?.key || '')
        if (!rawUrl) continue
        const t = (one as any)?.type || guessTypeFromUrl(rawUrl)
        results.push({ url: rawUrl, typ: (t === 'video' ? 'video' : 'image') })
      }

      const now = Date.now()
      setPostMedia((cur) => [
        ...cur,
        ...results.map((r) => ({
          url: `${r.url}${r.url.includes('?') ? '&' : '?'}v=${now}`,
          type: (r.typ || guessTypeFromUrl(r.url) || 'image'),
        })),
      ])
    } catch (e: any) {
      setErr(e?.message || 'Nahrání selhalo')
    } finally {
      setPostUploading(false)
      setPostUploadNote('')
    }
  }

  function postPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) postHandleFiles(e.target.files)
    e.target.value = ''
  }

  function postPickCamera(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) postHandleFiles(e.target.files)
    e.target.value = ''
  }

  function postDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    const files = e.dataTransfer?.files
    if (files && files.length) postHandleFiles(files)
  }

  function postDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
  }

  function removePostMedia(i: number) {
    setPostMedia((list) => list.filter((_, idx) => idx !== i))
  }

  async function submitPost(e: React.FormEvent) {
    e.preventDefault()
    if (!postAnimalId) return
    if (!postTitle.trim() && !postBody.trim() && postMedia.length === 0) return
    setPostSaving(true)
    setErr(null)
    try {
      await createPost({
        animalId: postAnimalId,
        title: postTitle.trim() || 'Bez názvu',
        text: postBody.trim() || undefined,
        media: postMedia.length
          ? postMedia.map((m) => ({
              key: m.url,
              url: m.url,
              type: m.type || guessTypeFromUrl(m.url) || 'image',
            }))
          : undefined,
      } as any)
      setOk('Příspěvek uložen')
      closePost()
    } catch (e: any) {
      setErr(e?.message || 'Uložení příspěvku selhalo')
    } finally {
      setPostSaving(false)
    }
  }

  /* ---------- Render ---------- */

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 2 }}
        spacing={1}
      >
        <Typography variant="h5" sx={{ fontWeight: 900 }}>
          Zvířata – správa
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button onClick={newAnimal} variant="contained" startIcon={<AddIcon />}>
            Přidat zvíře
          </Button>
          <Button onClick={onLogout} variant="text" startIcon={<LogoutIcon />}>
            Odhlásit
          </Button>
        </Stack>
      </Stack>

      {err && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {err}
        </Alert>
      )}
      {ok && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {ok}
        </Alert>
      )}

      <Grid container spacing={2}>
        {rows.map((a) => {
          const gal: any[] = (a as any).galerie || []
          const main =
            (a as any).main ||
            firstImageUrlFromGallery(gal) ||
            gal?.[0]?.url ||
            '/no-image.jpg'

          const isActive = (a as any).active !== false

          return (
            <Grid item xs={12} sm={6} md={4} lg={3} key={a.id}>
              <Card
                variant="outlined"
                sx={{
                  borderRadius: 3,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                }}
              >
                {!isActive && (
                  <Chip
                    label="NEAKTIVNÍ"
                    color="default"
                    size="small"
                    sx={{
                      position: 'absolute',
                      top: 8,
                      left: 8,
                      bgcolor: 'warning.light',
                      color: '#000',
                      zIndex: 1,
                    }}
                  />
                )}
                <CardMedia
                  component="img"
                  image={main}
                  alt={(a as any).jmeno || 'Zvíře'}
                  sx={{ height: 160, objectFit: 'cover' }}
                />
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                    {(a as any).jmeno || (a as any).name || '—'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {isActive ? 'Aktivní' : 'Neaktivní'}
                  </Typography>
                </CardContent>
                <CardActions sx={{ justifyContent: 'space-between' }}>
                  <Tooltip title="Přidat příspěvek">
                    <IconButton size="small" onClick={() => openPostFor(a.id)}>
                      <PostAddIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <span>
                    <IconButton size="small" onClick={() => editAnimal(a)} title="Upravit">
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => removeAnimal(a.id)}
                      title="Smazat"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </span>
                </CardActions>
              </Card>
            </Grid>
          )
        })}

        {rows.length === 0 && (
          <Grid item xs={12}>
            <Paper
              variant="outlined"
              sx={{ p: 4, borderRadius: 3, textAlign: 'center' }}
            >
              Zatím žádná zvířata
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* Create/Edit animal dialog */}
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
                  onChange={(e) => setForm((f) => ({ ...f, jmeno: e.target.value }))}
                  required
                  fullWidth
                />

                <RichTextEditor
                  label="Popis"
                  value={form.popis || ''}
                  onChange={(val) => setForm((f) => ({ ...f, popis: val }))}
                  helperText="Delší text o zvířeti – můžete použít tučné, kurzívu, podtržení a barvy."
                />

                <RichTextEditor
                  label="Charakteristika (krátká věta na kartě)"
                  value={form.charakteristik || ''}
                  onChange={(val) => setForm((f) => ({ ...f, charakteristik: val }))}
                  helperText="Krátká věta, kterou můžete zvýraznit formátováním."
                />

                {/* Birth info row */}
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Datum narození (přesné)"
                      type="date"
                      value={form.birthDate || ''}
                      onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))}
                      InputLabelProps={{ shrink: true }}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Rok narození (odhad)"
                      type="number"
                      value={form.bornYear || ''}
                      onChange={(e) => setForm((f) => ({ ...f, bornYear: e.target.value }))}
                      helperText="Vyplňte jen pokud není známé přesné datum."
                      inputProps={{ min: 1990, max: new Date().getFullYear() }}
                      fullWidth
                    />
                  </Grid>
                </Grid>

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={!!form.active}
                      onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                    />
                  }
                  label="Aktivní (zobrazit na webu)"
                />
              </Stack>

              {/* Uploader controls */}
              <Stack spacing={1}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                  Galerie
                </Typography>

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
                    accept="image/*,video/*"
                    capture="environment"
                    onChange={onPickCamera}
                  />
                </Stack>

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
                    userSelect: 'none',
                  }}
                >
                  Přetáhněte sem fotografie nebo videa
                </Box>

                {uploading && (
                  <Stack spacing={1} sx={{ mt: 1 }}>
                    <LinearProgress />
                    <Typography variant="caption" color="text.secondary">
                      {uploadNote}
                    </Typography>
                  </Stack>
                )}

                <Grid container spacing={1.5} sx={{ mt: 1 }}>
                  {(form.galerie || []).map((g, i) => {
                    const url = g.url
                    const isMain = !!form.main && stripCache(form.main) === stripCache(url)
                    const isVideo = isVideoMedia(g)
                    const poster = (g as any).posterUrl || (g as any).poster || undefined

                    return (
                      <Grid item xs={6} sm={4} md={3} key={`${url}-${i}`}>
                        <Box
                          sx={{
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 2,
                            overflow: 'hidden',
                            position: 'relative',
                          }}
                        >
                          <Box sx={{ position: 'relative', width: '100%', height: 120, bgcolor: '#f7f7f7' }}>
                            {isVideo ? (
                              <video
                                controls
                                preload="metadata"
                                playsInline
                                poster={poster}
                                style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }}
                              >
                                <source src={url} type={guessVideoMime(url)} />
                              </video>
                            ) : (
                              <img
                                src={url}
                                alt={`media-${i}`}
                                style={{
                                  width: '100%',
                                  height: '120px',
                                  objectFit: 'cover',
                                  display: 'block',
                                }}
                                onError={(ev) => {
                                  ;(ev.currentTarget as HTMLImageElement).style.opacity = '0.35'
                                }}
                              />
                            )}

                            <Tooltip
                              title={
                                isVideo
                                  ? 'Video nelze nastavit jako hlavní'
                                  : isMain
                                    ? 'Hlavní fotografie'
                                    : 'Nastavit jako hlavní'
                              }
                            >
                              <span>
                                <IconButton
                                  size="small"
                                  disabled={isVideo}
                                  onClick={() => setMain(url)}
                                  sx={{
                                    position: 'absolute',
                                    top: 6,
                                    right: 6,
                                    bgcolor: 'rgba(255,255,255,0.9)',
                                  }}
                                >
                                  {isMain ? (
                                    <StarIcon fontSize="small" color="warning" />
                                  ) : (
                                    <StarBorderIcon fontSize="small" />
                                  )}
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Box>

                          <Stack direction="row" spacing={1} sx={{ p: 1 }}>
                            <Button component="a" href={url} target="_blank" rel="noreferrer" size="small">
                              Otevřít
                            </Button>
                            <Button color="error" onClick={() => removeGalleryIndex(i)} size="small">
                              Odebrat
                            </Button>
                          </Stack>
                        </Box>
                      </Grid>
                    )
                  })}
                </Grid>

                {/* Optional manual URL add (kept for power-users) */}
                <Box sx={{ mt: 1 }}>
                  <TextField
                    label="Přidat URL do galerie"
                    placeholder="https://…"
                    fullWidth
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const v = (e.target as HTMLInputElement).value
                        addUrl(v)
                        ;(e.target as HTMLInputElement).value = ''
                      }
                    }}
                    helperText="Enter pro přidání."
                  />
                </Box>
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

      {/* Create Post dialog */}
      <Dialog open={postOpen} onClose={closePost} fullWidth maxWidth="md">
        <DialogTitle>Přidat příspěvek</DialogTitle>
        <form onSubmit={submitPost}>
          <DialogContent>
            <Stack spacing={2}>
              <TextField label="Titulek" value={postTitle} onChange={(e) => setPostTitle(e.target.value)} />
              <TextField
                label="Text"
                value={postBody}
                onChange={(e) => setPostBody(e.target.value)}
                multiline
                minRows={3}
              />

              {/* Emoji bar */}
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mb: 1 }}>
                {EMOJIS.map((emo) => (
                  <Button key={emo} size="small" variant="text" onClick={() => addPostEmoji(emo)} sx={{ minWidth: 36 }}>
                    {emo}
                  </Button>
                ))}
              </Stack>

              {/* Media uploader */}
              <Stack spacing={1}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                  Fotky / Videa
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                  <Button onClick={() => postFileRef.current?.click()} startIcon={<UploadIcon />} variant="outlined">
                    Vybrat soubory
                  </Button>
                  <input
                    ref={postFileRef}
                    type="file"
                    hidden
                    multiple
                    accept="image/*,video/*"
                    onChange={postPickFiles}
                  />
                  <Button onClick={() => postCameraRef.current?.click()} startIcon={<PhotoCameraIcon />} variant="outlined">
                    Vyfotit (telefon)
                  </Button>
                  <input
                    ref={postCameraRef}
                    type="file"
                    hidden
                    accept="image/*"
                    capture="environment"
                    onChange={postPickCamera}
                  />
                </Stack>

                <Box
                  onDrop={postDrop}
                  onDragOver={postDragOver}
                  sx={{
                    mt: 1,
                    p: 2,
                    border: '2px dashed',
                    borderColor: 'divider',
                    borderRadius: 2,
                    textAlign: 'center',
                    color: 'text.secondary',
                    cursor: 'copy',
                    userSelect: 'none',
                  }}
                >
                  Přetáhněte sem fotografie nebo videa
                </Box>

                {postUploading && (
                  <Stack spacing={1} sx={{ mt: 1 }}>
                    <LinearProgress />
                    <Typography variant="caption" color="text.secondary">
                      {postUploadNote}
                    </Typography>
                  </Stack>
                )}

                {postMedia.length > 0 && (
                  <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
                    {postMedia.map((m, i) => {
                      const isVideo = (m.type || guessTypeFromUrl(m.url)) === 'video'
                      return (
                        <Grid item xs={6} sm={4} md={3} key={`${m.url}-${i}`}>
                          <Box
                            sx={{
                              position: 'relative',
                              border: '1px solid',
                              borderColor: 'divider',
                              borderRadius: 2,
                              overflow: 'hidden',
                            }}
                          >
                            {isVideo ? (
                              <video
                                controls
                                preload="metadata"
                                playsInline
                                style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }}
                              >
                                <source src={m.url} type={guessVideoMime(m.url)} />
                              </video>
                            ) : (
                              <img
                                src={m.url}
                                alt={`post-media-${i}`}
                                style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }}
                              />
                            )}

                            <Tooltip title="Odebrat">
                              <IconButton
                                size="small"
                                onClick={() => removePostMedia(i)}
                                sx={{
                                  position: 'absolute',
                                  top: 6,
                                  right: 6,
                                  bgcolor: 'rgba(255,255,255,0.9)',
                                }}
                              >
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </Grid>
                      )
                    })}
                  </Grid>
                )}
              </Stack>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={closePost}>Zrušit</Button>
            <Button type="submit" variant="contained" disabled={postSaving || postUploading || !postAnimalId}>
              {postSaving ? 'Ukládám…' : 'Vytvořit příspěvek'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Container>
  )
}