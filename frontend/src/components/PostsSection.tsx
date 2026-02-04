// frontend/src/components/PostsSection.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Stack,
  TextField,
  Typography,
  IconButton,
  LinearProgress,
  Grid,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import UploadIcon from '@mui/icons-material/UploadFile'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import CloseIcon from '@mui/icons-material/Close'
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline'

import { useAccess } from '../context/AccessContext'
import { useAuth } from '../context/AuthContext'
import RichTextEditor from './RichTextEditor'
import SafeHTML from './SafeHTML'
import { apiUrl, authHeader, getToken } from '../services/api'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type NewMedia = { url: string; type?: 'image' | 'video'; poster?: string | null }

type ExistingPostMedia = {
  id: string
  url: string
  typ?: string
  type?: string
  poster?: string | null
  posterUrl?: string | null
}

type Post = {
  id: string
  animalId: string
  title: string
  body?: string | null
  createdAt: string
  active?: boolean
  media?: ExistingPostMedia[]
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

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text().catch(() => '')
  if (!res.ok) {
    throw new Error(text || `HTTP ${res.status}`)
  }
  try {
    return JSON.parse(text) as T
  } catch {
    return (undefined as unknown) as T
  }
}

type LightboxItem = {
  url: string
  isVideo: boolean
  poster?: string
  title?: string
}

// ─────────────────────────────────────────────────────────────
// Shape detection + caching (portrait/landscape/square)
// ─────────────────────────────────────────────────────────────
type Shape = 'portrait' | 'landscape' | 'square'
const SHAPE_STORAGE_KEY = 'dogpoint_posts_media_shapes_v1'

function safeLoadShapes(): Record<string, Shape> {
  try {
    if (typeof window === 'undefined') return {}
    const raw = window.localStorage.getItem(SHAPE_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, Shape>
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed
  } catch {
    return {}
  }
}

function safeSaveShapes(map: Record<string, Shape>) {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(SHAPE_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

function shapeFromWH(w: number, h: number): Shape {
  if (!w || !h) return 'landscape'
  const r = w / h
  if (r > 1.15) return 'landscape'
  if (r < 0.87) return 'portrait'
  return 'square'
}

function stripCacheBuster(u: string): string {
  // keep URL stable for caching shapes (ignore ?v=123)
  try {
    const url = new URL(u, typeof window !== 'undefined' ? window.location.href : 'https://x.local')
    url.searchParams.delete('v')
    return url.toString()
  } catch {
    // fallback
    return String(u || '').replace(/[?&]v=\d+/, '')
  }
}

function detectImageShape(url: string, timeoutMs = 8000): Promise<Shape> {
  return new Promise((resolve) => {
    const img = new Image()
    let done = false

    const finish = (s: Shape) => {
      if (done) return
      done = true
      resolve(s)
    }

    const t = window.setTimeout(() => finish('landscape'), timeoutMs)

    img.onload = () => {
      window.clearTimeout(t)
      finish(shapeFromWH((img as any).naturalWidth || 0, (img as any).naturalHeight || 0))
    }
    img.onerror = () => {
      window.clearTimeout(t)
      finish('landscape')
    }

    img.src = url
  })
}

function detectVideoShape(url: string, timeoutMs = 9000): Promise<Shape> {
  return new Promise((resolve) => {
    const v = document.createElement('video')
    let done = false

    const finish = (s: Shape) => {
      if (done) return
      done = true
      resolve(s)
    }

    const t = window.setTimeout(() => finish('landscape'), timeoutMs)

    v.preload = 'metadata'
    v.muted = true
    ;(v as any).playsInline = true

    v.onloadedmetadata = () => {
      window.clearTimeout(t)
      finish(shapeFromWH(v.videoWidth || 0, v.videoHeight || 0))
    }
    v.onerror = () => {
      window.clearTimeout(t)
      finish('landscape')
    }

    // use direct src to work in Safari/iOS
    v.src = url
  })
}

export default function PostsSection({ animalId }: { animalId: string }) {
  const { hasAccess } = useAccess()
  const { role } = useAuth()

  const isStaff = role === 'ADMIN' || role === 'MODERATOR'
  const unlocked = isStaff || hasAccess(animalId)

  // staff can create/delete posts
  const canWrite = isStaff

  // ONLY ADMIN can edit + manage post media
  const canEdit = role === 'ADMIN'

  // ✅ mobile hint (safe even if navigator is not available)
  const isMobile =
    typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  // Composer (new post)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [media, setMedia] = useState<NewMedia[]>([])
  const [saving, setSaving] = useState(false)

  // Upload helpers (new post)
  const [uploading, setUploading] = useState(false)
  const [uploadNote, setUploadNote] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const [editUploading, setEditUploading] = useState(false)
  const [editUploadNote, setEditUploadNote] = useState('')
  const editFileInputRef = useRef<HTMLInputElement>(null)
  const editCameraInputRef = useRef<HTMLInputElement>(null)
  const [editNewMedia, setEditNewMedia] = useState<NewMedia[]>([])

  const editPost = useMemo(() => posts.find((p) => p.id === editId) || null, [posts, editId])

  // Lightbox (desktop limited width)
  const [lb, setLb] = useState<LightboxItem | null>(null)
  const theme = useTheme()
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'))

  function openLightbox(item: LightboxItem) {
    setLb(item)
  }
  function closeLightbox() {
    setLb(null)
  }

  // ─────────────────────────────────────────────────────────────
  // Shape cache
  // ─────────────────────────────────────────────────────────────
  const [shapeByUrl, setShapeByUrl] = useState<Record<string, Shape>>(() => safeLoadShapes())

  useEffect(() => {
    safeSaveShapes(shapeByUrl)
  }, [shapeByUrl])

  async function ensureShape(url: string, isVid: boolean) {
    if (typeof window === 'undefined') return
    const stable = stripCacheBuster(url)
    if (!stable) return
    if (shapeByUrl[stable]) return

    try {
      const s = isVid ? await detectVideoShape(stable) : await detectImageShape(stable)
      setShapeByUrl((prev) => (prev[stable] ? prev : { ...prev, [stable]: s }))
    } catch {
      setShapeByUrl((prev) => (prev[stable] ? prev : { ...prev, [stable]: 'landscape' }))
    }
  }

  // detect shapes for visible media (posts + composer + edit)
  useEffect(() => {
    const urls: Array<{ url: string; isVideo: boolean }> = []

    // posts
    for (const p of posts || []) {
      for (const m of p.media || []) {
        const isVid = isVideoMedia(m)
        if (m.url) urls.push({ url: m.url, isVideo: isVid })
      }
    }

    // composer
    for (const m of media || []) {
      const isVid = isVideoUrl(m.url) || m.type === 'video'
      urls.push({ url: m.url, isVideo: isVid })
    }

    // edit new media
    for (const m of editNewMedia || []) {
      const isVid = isVideoUrl(m.url) || m.type === 'video'
      urls.push({ url: m.url, isVideo: isVid })
    }

    // fire and forget
    urls.forEach((x) => {
      void ensureShape(x.url, x.isVideo)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, media, editNewMedia])

  // ─────────────────────────────────────────────────────────────
  // Load posts (public)
  // ─────────────────────────────────────────────────────────────
  async function refresh() {
    setErr(null)
    try {
      const res = await fetch(apiUrl(`/api/posts/public?animalId=${encodeURIComponent(animalId)}`), {
        method: 'GET',
      })
      const list = await readJson<Post[]>(res)
      setPosts(list || [])
    } catch (e: any) {
      console.error('[PostsSection] list error', e)
      setErr(e?.message || 'Načítání příspěvků selhalo')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animalId])

  // ─────────────────────────────────────────────────────────────
  // Upload (shared: new/edit)
  // ─────────────────────────────────────────────────────────────
  async function uploadFilesToSpace(files: FileList | File[], into: 'new' | 'edit') {
    const arr = Array.from(files).filter((f) => f && f.size > 0)
    if (arr.length === 0) return

    const t = getToken()
    if (!t) {
      setErr('Chybí přihlášení. Přihlaste se prosím znovu.')
      return
    }

    if (into === 'new') {
      setUploading(true)
      setUploadNote('')
    } else {
      setEditUploading(true)
      setEditUploadNote('')
    }

    setErr(null)

    try {
      const now = Date.now()

      for (let i = 0; i < arr.length; i += 1) {
        const f = arr[i]
        const note = `Nahrávám ${i + 1} / ${arr.length}…`
        if (into === 'new') setUploadNote(note)
        else setEditUploadNote(note)

        const fd = new FormData()
        fd.append('file', f)

        const res = await fetch(apiUrl('/api/upload'), {
          method: 'POST',
          headers: { ...authHeader() },
          body: fd,
        })

        // ✅ accept poster from backend if provided
        const json = await readJson<{ url: string; type?: 'image' | 'video'; poster?: string | null }>(res)
        const url = String(json?.url || '')
        const poster = json?.poster ? String(json.poster) : null

        if (!url) throw new Error('Upload vrátil prázdnou URL.')

        const item: NewMedia = {
          url: `${url}${url.includes('?') ? '&' : '?'}v=${now}`,
          type: json?.type || guessTypeFromUrl(url),
          poster: poster ? `${poster}${poster.includes('?') ? '&' : '?'}v=${now}` : null,
        }

        // prime shape cache immediately (stable url without ?v)
        const isVid = item.type === 'video' || isVideoUrl(item.url)
        void ensureShape(item.url, isVid)

        if (into === 'new') setMedia((m) => [...m, item])
        else setEditNewMedia((m) => [...m, item])
      }
    } catch (e: any) {
      console.error('[PostsSection] upload error', e)
      setErr(e?.message || 'Nahrání selhalo')
    } finally {
      if (into === 'new') {
        setUploading(false)
        setUploadNote('')
      } else {
        setEditUploading(false)
        setEditUploadNote('')
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Create post
  // ─────────────────────────────────────────────────────────────
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canWrite) return
    if (!title.trim() && !body.trim() && media.length === 0) return

    const t = getToken()
    if (!t) {
      setErr('Chybí přihlášení. Přihlaste se prosím znovu.')
      return
    }

    setSaving(true)
    setErr(null)
    try {
      const payload = {
        animalId,
        title: title.trim() || 'Bez názvu',
        body: body.trim() || undefined,
        media: media.length
          ? media.map((m) => ({
              url: m.url,
              typ: m.type || guessTypeFromUrl(m.url) || 'image',
              poster: m.poster || undefined,
            }))
          : undefined,
      }

      const res = await fetch(apiUrl('/api/posts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(payload),
      })
      await readJson(res)

      setTitle('')
      setBody('')
      setMedia([])
      await refresh()
    } catch (e: any) {
      console.error('[PostsSection] create error', e)
      setErr(e?.message || 'Uložení selhalo')
    } finally {
      setSaving(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Delete post (staff)
  // ─────────────────────────────────────────────────────────────
  async function handleDelete(postId: string) {
    if (!canWrite) return
    const ok = window.confirm('Opravdu chcete tento příspěvek smazat?')
    if (!ok) return

    const t = getToken()
    if (!t) {
      setErr('Chybí přihlášení. Přihlaste se prosím znovu.')
      return
    }

    try {
      const res = await fetch(apiUrl(`/api/posts/${encodeURIComponent(postId)}`), {
        method: 'DELETE',
        headers: { ...authHeader() },
      })
      await readJson(res)
      setPosts((prev) => prev.filter((p) => p.id !== postId))
    } catch (e: any) {
      console.error('[PostsSection] delete error', e)
      setErr(e?.message || 'Smazání příspěvku selhalo.')
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Edit (admin)
  // ─────────────────────────────────────────────────────────────
  function openEdit(p: Post) {
    if (!canEdit) return
    setEditId(p.id)
    setEditTitle(p.title || '')
    setEditBody(p.body || '')
    setEditNewMedia([])
    setEditOpen(true)
  }

  function closeEdit() {
    setEditOpen(false)
    setEditId(null)
    setEditNewMedia([])
  }

  async function saveEdit() {
    if (!canEdit || !editId) return

    const t = getToken()
    if (!t) {
      setErr('Chybí přihlášení (admin). Přihlaste se prosím znovu.')
      return
    }

    setEditSaving(true)
    setErr(null)
    try {
      // 1) patch text/title
      const res = await fetch(apiUrl(`/api/posts/${encodeURIComponent(editId)}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({
          title: editTitle.trim() || 'Bez názvu',
          body: editBody.trim() || undefined,
        }),
      })
      await readJson(res)

      // 2) add newly uploaded media (if any)
      if (editNewMedia.length > 0) {
        const res2 = await fetch(apiUrl(`/api/posts/${encodeURIComponent(editId)}/media`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader() },
          body: JSON.stringify({
            media: editNewMedia.map((m) => ({
              url: m.url,
              typ: m.type || guessTypeFromUrl(m.url) || 'image',
              poster: m.poster || undefined,
            })),
          }),
        })
        await readJson(res2)
      }

      closeEdit()
      await refresh()
    } catch (e: any) {
      console.error('[PostsSection] edit save error', e)
      setErr(e?.message || 'Uložení změn selhalo')
    } finally {
      setEditSaving(false)
    }
  }

  async function deleteExistingMedia(postId: string, mediaId: string) {
    if (!canEdit) return
    const ok = window.confirm('Opravdu chcete smazat toto médium?')
    if (!ok) return

    const t = getToken()
    if (!t) {
      setErr('Chybí přihlášení (admin). Přihlaste se prosím znovu.')
      return
    }

    try {
      const res = await fetch(
        apiUrl(`/api/posts/${encodeURIComponent(postId)}/media/${encodeURIComponent(mediaId)}`),
        {
          method: 'DELETE',
          headers: { ...authHeader() },
        },
      )
      await readJson(res)
      await refresh()
    } catch (e: any) {
      console.error('[PostsSection] delete media error', e)
      setErr(e?.message || 'Smazání média selhalo.')
    }
  }

  // ─────────────────────────────────────────────────────────────
  // UI handlers
  // ─────────────────────────────────────────────────────────────
  function addEmoji(emoji: string) {
    setBody((prev) => (prev ? `${prev} ${emoji}` : emoji))
  }

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) uploadFilesToSpace(e.target.files, 'new')
    e.target.value = ''
  }
  function onPickCamera(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) uploadFilesToSpace(e.target.files, 'new')
    e.target.value = ''
  }
  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    const files = e.dataTransfer?.files
    if (files && files.length) uploadFilesToSpace(files, 'new')
  }
  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
  }
  function removeMediaIndex(i: number) {
    setMedia((list) => list.filter((_, idx) => idx !== i))
  }

  function onEditPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) uploadFilesToSpace(e.target.files, 'edit')
    e.target.value = ''
  }
  function onEditPickCamera(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) uploadFilesToSpace(e.target.files, 'edit')
    e.target.value = ''
  }
  function removeEditNewMediaIndex(i: number) {
    setEditNewMedia((list) => list.filter((_, idx) => idx !== i))
  }

  // ─────────────────────────────────────────────────────────────
  // Media thumb component (auto portrait/landscape + blurred bg + play overlay)
  // ─────────────────────────────────────────────────────────────
  function MediaThumb({
    url,
    isVideo,
    poster,
    onOpen,
  }: {
    url: string
    isVideo: boolean
    poster?: string
    onOpen: () => void
  }) {
    const stable = stripCacheBuster(url)
    const shape = shapeByUrl[stable] || 'landscape'
    const aspectRatio =
      shape === 'portrait' ? '3 / 4' : shape === 'square' ? '1 / 1' : '4 / 3'

    const bgSrc = (isVideo ? poster : url) || url
    const fit = shape === 'portrait' ? 'contain' : 'cover'

    return (
      <Box
        onClick={onOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onOpen()
        }}
        sx={{
          position: 'relative',
          width: '100%',
          aspectRatio,
          bgcolor: '#000',
          cursor: 'pointer',
          userSelect: 'none',
          overflow: 'hidden',
        }}
      >
        {/* Blurred background (helps portrait media look great) */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${bgSrc})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(14px)',
            transform: 'scale(1.15)',
            opacity: 0.55,
          }}
        />

        {/* Foreground media */}
        {isVideo ? (
          <Box
            component="video"
            // best compatibility across iOS/Android/Desktop:
            src={url}
            muted
            playsInline
            preload="metadata"
            poster={poster}
            controls={false}
            sx={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: fit,
              display: 'block',
            }}
          />
        ) : (
          <Box
            component="img"
            src={url}
            alt=""
            sx={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: fit,
              display: 'block',
            }}
          />
        )}

        {/* Video play overlay */}
        {isVideo && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <PlayCircleOutlineIcon sx={{ fontSize: 58, color: 'rgba(255,255,255,0.92)' }} />
          </Box>
        )}
      </Box>
    )
  }

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  return (
    <Box sx={{ mt: 2 }}>
      {err && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {err}
        </Alert>
      )}

      {/* ✅ Composer FIRST (Admin/Moderator) */}
      {canWrite && (
        <Box
          component="form"
          onSubmit={onSubmit}
          sx={{
            mb: 2,
            p: 1.5,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
          }}
        >
          <Stack spacing={2}>
            <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
              Nový příspěvek
            </Typography>

            {/* Upload */}
            <Stack spacing={1}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                <Button onClick={() => fileInputRef.current?.click()} startIcon={<UploadIcon />} variant="outlined">
                  Vybrat soubory
                </Button>
                <input ref={fileInputRef} type="file" hidden multiple accept="image/*,video/*" onChange={onPickFiles} />

                <Button onClick={() => cameraInputRef.current?.click()} startIcon={<PhotoCameraIcon />} variant="outlined">
                  Vyfotit (telefon)
                </Button>
                <input
                  ref={cameraInputRef}
                  type="file"
                  hidden
                  accept="image/*"
                  {...(isMobile ? ({ capture: 'environment' } as any) : {})}
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

              {media.length > 0 && (
                <Grid container spacing={1.5} sx={{ mt: 1 }}>
                  {media.map((m, i) => {
                    const isVideo = isVideoMedia(m)
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
                          <MediaThumb
                            url={m.url}
                            isVideo={isVideo}
                            poster={m.poster || undefined}
                            onOpen={() =>
                              openLightbox({
                                url: m.url,
                                isVideo,
                                poster: m.poster || undefined,
                                title: title || 'Média',
                              })
                            }
                          />

                          <Tooltip title="Odebrat">
                            <IconButton
                              size="small"
                              onClick={() => removeMediaIndex(i)}
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

            <TextField label="Titulek" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth />
            <RichTextEditor label="Text" value={body} onChange={setBody} />

            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              {EMOJIS.map((emo) => (
                <Button key={emo} size="small" variant="text" onClick={() => addEmoji(emo)} sx={{ minWidth: 36 }}>
                  {emo}
                </Button>
              ))}
            </Stack>

            <Button type="submit" variant="contained" disabled={saving || uploading}>
              {saving ? 'Ukládám…' : 'Přidat příspěvek'}
            </Button>
          </Stack>
        </Box>
      )}

      {!unlocked && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Příspěvky jsou viditelné po adopci. Dokončete adopci pro přístup k novinkám.
        </Alert>
      )}

      {/* Posts list AFTER composer */}
      {loading ? (
        <Typography color="text.secondary">Načítám…</Typography>
      ) : posts.length === 0 ? (
        <Typography color="text.secondary">Zatím žádné příspěvky.</Typography>
      ) : (
        <Stack spacing={1.5} sx={{ mb: 3 }}>
          {posts.map((p) => (
            <Box
              key={p.id}
              sx={{
                p: 1.5,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                position: 'relative',
              }}
            >
              {(canEdit || canWrite) && (
                <Stack
                  direction="row"
                  spacing={0.5}
                  sx={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    bgcolor: 'rgba(255,255,255,0.9)',
                    borderRadius: 2,
                    p: 0.25,
                  }}
                >
                  {canEdit && (
                    <IconButton size="small" onClick={() => openEdit(p)} aria-label="Upravit">
                      <EditIcon fontSize="small" />
                    </IconButton>
                  )}
                  {canWrite && (
                    <IconButton size="small" onClick={() => handleDelete(p.id)} aria-label="Smazat">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Stack>
              )}

              <Typography sx={{ fontWeight: 800 }}>{p.title}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                {new Date(p.createdAt).toLocaleString()}
              </Typography>

              {p.media && p.media.length > 0 && (
                <Grid container spacing={1} sx={{ mb: 1 }}>
                  {p.media.map((m, i) => {
                    const isVideo = isVideoMedia(m)
                    const poster = m.posterUrl || m.poster || undefined
                    return (
                      <Grid item xs={6} sm={4} md={3} key={`${m.id}-${i}`}>
                        <Box
                          sx={{
                            position: 'relative',
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 2,
                            overflow: 'hidden',
                          }}
                        >
                          <MediaThumb
                            url={m.url}
                            isVideo={isVideo}
                            poster={poster}
                            onOpen={() =>
                              openLightbox({
                                url: m.url,
                                isVideo,
                                poster,
                                title: p.title,
                              })
                            }
                          />

                          {canEdit && (
                            <Tooltip title="Smazat médium">
                              <IconButton
                                size="small"
                                onClick={() => deleteExistingMedia(p.id, m.id)}
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
                          )}
                        </Box>
                      </Grid>
                    )
                  })}
                </Grid>
              )}

              {p.body && (
                <Box sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
                  <SafeHTML>{p.body}</SafeHTML>
                </Box>
              )}
            </Box>
          ))}
        </Stack>
      )}

      {/* ───────────── Lightbox (desktop 1/3 width) ───────────── */}
      <Dialog
        open={!!lb}
        onClose={closeLightbox}
        fullWidth
        maxWidth="md"
        PaperProps={{
          sx: {
            width: isMdUp ? '33vw' : '95vw',
            maxWidth: isMdUp ? '33vw' : '95vw',
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle sx={{ pr: 5 }}>
          {lb?.title || 'Média'}
          <IconButton onClick={closeLightbox} sx={{ position: 'absolute', right: 8, top: 8 }} aria-label="Zavřít">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ bgcolor: '#000', p: 1.5 }}>
          {lb?.isVideo ? (
            <Box
              component="video"
              controls
              playsInline
              preload="metadata"
              poster={lb.poster}
              src={lb.url}
              sx={{
                width: '100%',
                maxHeight: isMdUp ? '70vh' : '60vh',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          ) : (
            <Box
              component="img"
              src={lb?.url || ''}
              alt=""
              sx={{
                width: '100%',
                maxHeight: isMdUp ? '70vh' : '60vh',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          )}
        </DialogContent>
        <DialogActions>
          {lb?.url ? (
            <Button href={lb.url} target="_blank" rel="noreferrer" variant="outlined">
              Otevřít v nové záložce
            </Button>
          ) : null}
          <Button onClick={closeLightbox}>Zavřít</Button>
        </DialogActions>
      </Dialog>

      {/* ───────────── Admin edit dialog ───────────── */}
      <Dialog open={editOpen} onClose={closeEdit} fullWidth maxWidth="md">
        <DialogTitle>Upravit příspěvek</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Titulek" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            <RichTextEditor label="Text" value={editBody} onChange={setEditBody} />

            {editPost?.media && editPost.media.length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                  Existující média
                </Typography>
                <Grid container spacing={1}>
                  {editPost.media.map((m) => {
                    const isVideo = isVideoMedia(m)
                    const poster = m.posterUrl || m.poster || undefined
                    return (
                      <Grid item xs={6} sm={4} md={3} key={m.id}>
                        <Box
                          sx={{
                            position: 'relative',
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 2,
                            overflow: 'hidden',
                          }}
                        >
                          <MediaThumb
                            url={m.url}
                            isVideo={isVideo}
                            poster={poster}
                            onOpen={() =>
                              openLightbox({
                                url: m.url,
                                isVideo,
                                poster,
                                title: editTitle || 'Média',
                              })
                            }
                          />

                          <Tooltip title="Smazat médium">
                            <IconButton
                              size="small"
                              onClick={() => deleteExistingMedia(editPost.id, m.id)}
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
              </Box>
            )}

            {/* Add new media */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                Přidat nová média
              </Typography>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" sx={{ mt: 1 }}>
                <Button onClick={() => editFileInputRef.current?.click()} startIcon={<UploadIcon />} variant="outlined">
                  Vybrat soubory
                </Button>
                <input ref={editFileInputRef} type="file" hidden multiple accept="image/*,video/*" onChange={onEditPickFiles} />

                <Button onClick={() => editCameraInputRef.current?.click()} startIcon={<PhotoCameraIcon />} variant="outlined">
                  Vyfotit (telefon)
                </Button>
                <input
                  ref={editCameraInputRef}
                  type="file"
                  hidden
                  accept="image/*"
                  {...(isMobile ? ({ capture: 'environment' } as any) : {})}
                  onChange={onEditPickCamera}
                />
              </Stack>

              {editUploading && (
                <Stack spacing={1} sx={{ mt: 1 }}>
                  <LinearProgress />
                  <Typography variant="caption" color="text.secondary">
                    {editUploadNote}
                  </Typography>
                </Stack>
              )}

              {editNewMedia.length > 0 && (
                <Grid container spacing={1.5} sx={{ mt: 1 }}>
                  {editNewMedia.map((m, i) => {
                    const isVideo = isVideoMedia(m)
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
                          <MediaThumb
                            url={m.url}
                            isVideo={isVideo}
                            poster={m.poster || undefined}
                            onOpen={() =>
                              openLightbox({
                                url: m.url,
                                isVideo,
                                poster: m.poster || undefined,
                                title: editTitle || 'Média',
                              })
                            }
                          />

                          <Tooltip title="Odebrat">
                            <IconButton
                              size="small"
                              onClick={() => removeEditNewMediaIndex(i)}
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
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEdit} disabled={editSaving}>
            Zrušit
          </Button>
          <Button variant="contained" onClick={saveEdit} disabled={editSaving || !editId}>
            {editSaving ? 'Ukládám…' : 'Uložit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}