// frontend/src/pages/ModeratorNewPost.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Container,
  Typography,
  TextField,
  Button,
  Stack,
  Grid,
  Box,
  Alert,
  LinearProgress,
  IconButton,
  Tooltip,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
} from '@mui/material'
import UploadIcon from '@mui/icons-material/UploadFile'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditIcon from '@mui/icons-material/Edit'
import { useNavigate } from 'react-router-dom'

import RichTextEditor from '../components/RichTextEditor'
import styles from './ModeratorNewPost.module.css'
import { fetchAnimals, type Animal, uploadMedia } from '../api'
import { apiUrl, authHeader } from '../services/api'
import { getToken } from '../services/api'

// If upload returns { key }, we must build a public URL.
// Prefer env if you have it; fallback to your known Space CDN.
const SPACE_PUBLIC_BASE =
  (import.meta.env.VITE_DO_SPACE_PUBLIC_BASE as string | undefined)?.replace(/\/+$/, '') ||
  'https://dogpoint.fra1.digitaloceanspaces.com'

type PostMedia = {
  url: string
  type?: 'image' | 'video'
  typ?: 'image' | 'video'
  poster?: string | null
  posterUrl?: string | null
}

type PostFromApi = {
  id: string
  title: string
  body?: string | null
  status: string
  animalId: string
  createdAt: string
  animal?: { id: string; jmeno?: string | null; name?: string | null } | null
  media?: Array<{ id?: string; url: string; typ?: string; type?: string }>
}

const EMOJIS = ['🐾', '❤️', '😊', '🥰', '👏', '🎉', '😍', '🤗', '🌟', '👍']

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|m4v|mov)(\?|$)/i.test(url || '')
}

function isVideoMedia(m: { url?: string; typ?: string; type?: string }): boolean {
  const t = String(m.typ || m.type || '').toLowerCase()
  if (t.includes('video')) return true
  return isVideoUrl(String(m.url || ''))
}

function guessVideoMime(url: string): string {
  const u = (url || '').toLowerCase()
  if (u.includes('.webm')) return 'video/webm'
  return 'video/mp4'
}

function guessTypeFromUrl(u: string): 'image' | 'video' | undefined {
  const lc = (u || '').toLowerCase()
  if (/\.(mp4|webm|mov|m4v)(\?|$)/.test(lc)) return 'video'
  if (/\.(jpg|jpeg|png|gif|webp|avif)(\?|$)/.test(lc)) return 'image'
  return undefined
}

function buildPublicUrlFromKey(key: string): string {
  const cleanKey = String(key || '').replace(/^\//, '')
  return `${SPACE_PUBLIC_BASE}/${cleanKey}`
}

function ensureMediaUrl(url: string | undefined): string {
  if (!url || typeof url !== 'string') return ''
  const u = url.trim()
  if (/^https?:\/\//i.test(u)) return u
  return `${SPACE_PUBLIC_BASE.replace(/\/+$/, '')}/${u.replace(/^\//, '')}`
}

export default function ModeratorNewPost() {
  const navigate = useNavigate()

  const [animals, setAnimals] = useState<Animal[]>([])
  const [animalId, setAnimalId] = useState<string>('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [media, setMedia] = useState<PostMedia[]>([])

  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadNote, setUploadNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const [allPosts, setAllPosts] = useState<PostFromApi[]>([])
  const [allPostsLoading, setAllPostsLoading] = useState(false)
  const [filterAnimalId, setFilterAnimalId] = useState<string>('')
  const [editPost, setEditPost] = useState<PostFromApi | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [editAnimalId, setEditAnimalId] = useState('')
  const [editMedia, setEditMedia] = useState<PostMedia[]>([])
  const [editUploading, setEditUploading] = useState(false)
  const [editUploadNote, setEditUploadNote] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const editFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const list = await fetchAnimals()
        setAnimals(list || [])
      } catch (e: any) {
        setError(e?.message || 'Nepodařilo se načíst seznam zvířat')
      }
    })()
  }, [])

  const fetchAllPosts = useCallback(async () => {
    const token = getToken()
    if (!token) return
    setAllPostsLoading(true)
    try {
      const res = await fetch(apiUrl('/api/posts/all'), {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Načtení příspěvků selhalo')
      const data = (await res.json()) as PostFromApi[]
      setAllPosts(Array.isArray(data) ? data : [])
    } catch {
      setAllPosts([])
    } finally {
      setAllPostsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAllPosts()
  }, [fetchAllPosts])

  function openEdit(p: PostFromApi) {
    setEditPost(p)
    setEditTitle(p.title || '')
    setEditBody(p.body || '')
    setEditAnimalId(p.animalId || '')
    const rawMedia = Array.isArray(p.media) ? p.media : []
    setEditMedia(
      rawMedia
        .filter((m: any) => m && (m.url || m.URL))
        .map((m: any) => {
          const url = ensureMediaUrl(m.url || m.URL)
          return {
            url,
            type: (m.typ || m.type || guessTypeFromUrl(url) || 'image') as 'image' | 'video',
            typ: (m.typ || m.type || 'image') as 'image' | 'video',
          }
        }),
    )
  }

  function closeEdit() {
    setEditPost(null)
    setEditTitle('')
    setEditBody('')
    setEditAnimalId('')
    setEditMedia([])
  }

  function removeEditMedia(idx: number) {
    setEditMedia((list) => list.filter((_, i) => i !== idx))
  }

  async function handleEditFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f && f.size > 0)
    if (!arr.length) return
    setEditUploading(true)
    setError(null)
    try {
      const results: PostMedia[] = []
      const bust = Date.now()
      for (let i = 0; i < arr.length; i++) {
        setEditUploadNote(`Nahrávám ${i + 1} / ${arr.length}…`)
        const one = await uploadMedia(arr[i])
        const rawUrl = String((one as any)?.url || '')
        const rawKey = String((one as any)?.key || '')
        let publicUrl = rawUrl
        if (!publicUrl && rawKey) publicUrl = buildPublicUrlFromKey(rawKey)
        if (publicUrl) {
          const t = (guessTypeFromUrl(publicUrl) || (arr[i].type.startsWith('video/') ? 'video' : 'image')) as 'image' | 'video'
          results.push({ url: `${publicUrl}${publicUrl.includes('?') ? '&' : '?'}v=${bust}`, type: t, typ: t })
        }
      }
      if (results.length) setEditMedia((cur) => [...cur, ...results])
    } catch (e: any) {
      setError(e?.message || 'Nahrání selhalo')
    } finally {
      setEditUploading(false)
      setEditUploadNote('')
    }
  }

  async function saveEdit() {
    if (!editPost) return
    const token = getToken()
    if (!token) return
    setEditSaving(true)
    try {
      const res = await fetch(apiUrl(`/api/posts/${editPost.id}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: editTitle.trim(),
          body: editBody,
          animalId: editAnimalId || undefined,
          media: editMedia.map((m) => ({ url: m.url, typ: m.type || m.typ || 'image' })),
        }),
      })
      if (!res.ok) throw new Error('Uložení selhalo')
      setOk('Příspěvek byl upraven.')
      closeEdit()
      fetchAllPosts()
    } catch (e: any) {
      setError(e?.message || 'Uložení selhalo')
    } finally {
      setEditSaving(false)
    }
  }

  function addEmoji(emoji: string) {
    setBody((prev) => (prev ? `${prev} ${emoji}` : emoji))
  }

  function removeMedia(idx: number) {
    setMedia((list) => list.filter((_, i) => i !== idx))
  }

  /* ---------- Upload helpers ---------- */

  async function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f && f.size > 0)
    if (!arr.length) return

    setUploading(true)
    setError(null)

    try {
      const results: Array<{ url: string; type?: 'image' | 'video' }> = []
      const bust = Date.now()

      for (let i = 0; i < arr.length; i++) {
        const f = arr[i]
        setUploadNote(`Nahrávám ${i + 1} / ${arr.length}…`)

        // eslint-disable-next-line no-await-in-loop
        const one = await uploadMedia(f)

        // Accept {url} or {key}
        const rawUrl = String((one as any)?.url || '')
        const rawKey = String((one as any)?.key || '')

        let publicUrl = rawUrl
        if (!publicUrl && rawKey) publicUrl = buildPublicUrlFromKey(rawKey)

        if (publicUrl) {
          const t = (guessTypeFromUrl(publicUrl) || (f.type.startsWith('video/') ? 'video' : 'image')) as
            | 'image'
            | 'video'

          results.push({
            url: `${publicUrl}${publicUrl.includes('?') ? '&' : '?'}v=${bust}`,
            type: t,
          })
        }
      }

      if (results.length) {
        setMedia((cur) => [...cur, ...results.map((r) => ({ url: r.url, type: r.type, typ: r.type }))])
      }
    } catch (e: any) {
      console.error('[ModeratorNewPost] upload error', e)
      setError(e?.message || 'Nahrání selhalo')
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

  /* ---------- SAVE ---------- */

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setOk(null)

    const token = getToken()
if (!token) {
  setError('Nejste přihlášen jako moderátor / admin.')
  return
}

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
}

    if (!animalId) {
      setError('Vyberte prosím zvíře.')
      return
    }
    if (!title.trim() && !body.trim() && media.length === 0) {
      setError('Vyplňte titulek nebo text, nebo přidejte média.')
      return
    }

    setLoading(true)
    try {
      const payload = {
        animalId,
        title: title.trim() || 'Bez názvu',
        body: body.trim() || undefined,
        media: media.length
          ? media.map((m) => ({
              url: m.url,
              typ: (m.type || m.typ || guessTypeFromUrl(m.url) || 'image') as 'image' | 'video',
            }))
          : undefined,
      }

      const res = await fetch(apiUrl('/api/posts'), {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        console.error('[ModeratorNewPost] save error', res.status, text)
        throw new Error(`Uložení selhalo (HTTP ${res.status}): ${text || 'Neznámá chyba'}`)
      }

      setOk('Příspěvek uložen. Pokud jste moderátor, čeká na schválení.')
      setTitle('')
      setBody('')
      setMedia([])
      fetchAllPosts()
    } catch (e: any) {
      console.error('[ModeratorNewPost] save error', e)
      setError(e?.message || 'Uložení příspěvku selhalo')
    } finally {
      setLoading(false)
    }
  }

  /* ---------- RENDER ---------- */

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h5" sx={{ fontWeight: 900, mb: 2 }}>
        Nový příběh / příspěvek
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {ok && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {ok}
        </Alert>
      )}

      <form onSubmit={onSubmit}>
        <Stack spacing={3}>
          {/* Animal selector */}
          <TextField
            select
            label="Zvíře"
            value={animalId}
            onChange={(e) => setAnimalId(e.target.value)}
            required
            fullWidth
            SelectProps={{
              native: true,
              inputProps: { 'aria-label': 'Zvíře', title: 'Zvíře', id: 'post-animal-select' },
            }}
          >
            <option value="">— vyberte zvíře —</option>
            {animals.map((a) => (
              <option key={a.id} value={a.id}>
                {a.jmeno || (a as any).name || 'Bez jména'}
              </option>
            ))}
          </TextField>

          <TextField label="Titulek" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth />

          <RichTextEditor
            label="Text příspěvku"
            value={body}
            onChange={(val) => setBody(val)}
            helperText="Napište, co je nového – můžete použít formátování."
          />

          {/* Emoji bar */}
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            {EMOJIS.map((emo) => (
              <Button key={emo} size="small" variant="text" onClick={() => addEmoji(emo)} sx={{ minWidth: 36 }}>
                {emo}
              </Button>
            ))}
          </Stack>

          {/* Media uploader */}
          <Stack spacing={1}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              Fotky / videa
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
              <Button onClick={() => fileRef.current?.click()} startIcon={<UploadIcon />} variant="outlined">
                Vybrat soubory
              </Button>
              <input
                ref={fileRef}
                type="file"
                hidden
                multiple
                accept="image/*,video/*"
                onChange={onPickFiles}
                aria-label="Vybrat soubory"
              />

              <Button onClick={() => cameraRef.current?.click()} startIcon={<PhotoCameraIcon />} variant="outlined">
                Vyfotit (telefon)
              </Button>
              <input
                ref={cameraRef}
                type="file"
                hidden
                accept="image/*,video/*"
                onChange={onPickCamera}
                aria-label="Vyfotit (telefon)"
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

            {media.length > 0 && (
              <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
                {media.map((m, i) => {
                  const video = isVideoMedia(m)
                  const poster = m.posterUrl || m.poster || undefined

                  return (
                    <Grid item xs={6} sm={4} md={3} key={`${m.url}-${i}`}>
                      <Box
                        className={styles.mediaThumb}
                        sx={{
                          position: 'relative',
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 2,
                          overflow: 'hidden',
                        }}
                      >
                        {video ? (
                          <video
                            controls
                            preload="metadata"
                            playsInline
                            poster={poster}
                          >
                            <source src={m.url} type={guessVideoMime(m.url)} />
                          </video>
                        ) : (
                          <img
                            src={m.url}
                            alt={`post-media-${i}`}
                          />
                        )}

                        <Tooltip title="Odebrat">
                          <IconButton
                            size="small"
                            onClick={() => removeMedia(i)}
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

          <Stack direction="row" spacing={2} justifyContent="flex-end">
            <Button variant="text" onClick={() => navigate('/moderator/animals?tab=pending')}>
              Zpět
            </Button>
            <Button type="submit" variant="contained" disabled={loading || uploading}>
              {loading ? 'Ukládám…' : 'Uložit příspěvek'}
            </Button>
          </Stack>
        </Stack>
      </form>

      <Divider sx={{ my: 4 }} />

      <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
        Všechny příspěvky
      </Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} sx={{ mb: 2 }}>
        <TextField
          select
          label="Filtrovat podle zvířete"
          value={filterAnimalId}
          onChange={(e) => setFilterAnimalId(e.target.value)}
          size="small"
          sx={{ minWidth: 220 }}
          SelectProps={{
            native: true,
            inputProps: { 'aria-label': 'Filtrovat podle zvířete', title: 'Filtrovat podle zvířete', id: 'post-filter-animal' },
          }}
        >
          <option value="">— všechna zvířata —</option>
          {animals.map((a) => (
            <option key={a.id} value={a.id}>
              {a.jmeno || (a as any).name || 'Bez jména'}
            </option>
          ))}
        </TextField>
        <Button size="small" onClick={fetchAllPosts} disabled={allPostsLoading}>
          Obnovit
        </Button>
      </Stack>

      {allPostsLoading ? (
        <Typography color="text.secondary">Načítám…</Typography>
      ) : (() => {
        const filtered = filterAnimalId
          ? allPosts.filter((p) => p.animalId === filterAnimalId)
          : allPosts
        if (filtered.length === 0) {
          return (
            <Typography color="text.secondary">
              {filterAnimalId ? 'Žádné příspěvky pro vybrané zvíře.' : 'Žádné příspěvky.'}
            </Typography>
          )
        }
        return (
          <Stack spacing={2}>
            {filtered.map((p) => {
              const animalName = p.animal?.jmeno || p.animal?.name || p.animalId
              const created = new Date(p.createdAt).toLocaleDateString('cs-CZ')
              return (
                <Paper key={p.id} variant="outlined" sx={{ p: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontWeight: 700 }}>{p.title || 'Bez názvu'}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Zvíře: {animalName} · {created} · {p.status}
                      </Typography>
                    </Box>
                    <Button size="small" startIcon={<EditIcon />} onClick={() => openEdit(p)} variant="outlined">
                      Upravit
                    </Button>
                  </Stack>
                  {p.body && (
                    <Box
                      sx={{ mt: 1, '& img': { maxWidth: '100%' }, '& video': { maxWidth: '100%' } }}
                      dangerouslySetInnerHTML={{ __html: p.body }}
                    />
                  )}
                </Paper>
              )
            })}
          </Stack>
        )
      })()}

      <Dialog open={!!editPost} onClose={closeEdit} maxWidth="md" fullWidth>
        <DialogTitle>Upravit příspěvek</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Zvíře"
              value={editAnimalId}
              onChange={(e) => setEditAnimalId(e.target.value)}
              fullWidth
              SelectProps={{
                native: true,
                inputProps: { 'aria-label': 'Zvíře', title: 'Zvíře', id: 'post-edit-animal-select' },
              }}
            >
              <option value="">— vyberte zvíře —</option>
              {animals.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.jmeno || (a as any).name || 'Bez jména'}
                </option>
              ))}
            </TextField>
            <TextField
              label="Titulek"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              fullWidth
            />
            <RichTextEditor
              label="Text příspěvku"
              value={editBody}
              onChange={(val) => setEditBody(val)}
            />
            <Stack spacing={1}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                Fotky / videa
              </Typography>
              <Stack direction="row" spacing={2} alignItems="center">
                <Button
                  onClick={() => editFileRef.current?.click()}
                  startIcon={<UploadIcon />}
                  variant="outlined"
                  size="small"
                >
                  Přidat
                </Button>
                <input
                  ref={editFileRef}
                  type="file"
                  hidden
                  multiple
                  accept="image/*,video/*"
                  onChange={(e) => e.target.files && handleEditFiles(e.target.files)}
                  aria-label="Přidat fotky nebo videa"
                />
                {editUploading && (
                  <>
                    <LinearProgress sx={{ flex: 1, maxWidth: 120 }} />
                    <Typography variant="caption" color="text.secondary">{editUploadNote}</Typography>
                  </>
                )}
              </Stack>
              {editMedia.length > 0 && (
                <Grid container spacing={1} sx={{ mt: 0.5 }}>
                  {editMedia.map((m, i) => {
                    const video = isVideoMedia(m)
                    return (
                      <Grid item xs={6} sm={4} key={`${m.url}-${i}`}>
                        <Box
                          className={styles.mediaThumb}
                          sx={{
                            position: 'relative',
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 2,
                            overflow: 'hidden',
                          }}
                        >
                          {video ? (
                            <video controls preload="metadata" playsInline>
                              <source src={m.url} type={guessVideoMime(m.url)} />
                            </video>
                          ) : (
                            <img src={m.url} alt={`edit-media-${i}`} />
                          )}
                          <Tooltip title="Odebrat">
                            <IconButton
                              size="small"
                              onClick={() => removeEditMedia(i)}
                              sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'rgba(255,255,255,0.9)' }}
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
          <Button onClick={closeEdit}>Zrušit</Button>
          <Button onClick={saveEdit} variant="contained" disabled={editSaving || editUploading}>
            {editSaving ? 'Ukládám…' : 'Uložit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}