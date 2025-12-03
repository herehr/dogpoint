// frontend/src/components/PostsSection.tsx
import React, { useEffect, useState, useRef } from 'react'
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
} from '@mui/material'
import UploadIcon from '@mui/icons-material/UploadFile'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import DeleteIcon from '@mui/icons-material/Delete'

import { useAccess } from '../context/AccessContext'
import { useAuth } from '../context/AuthContext'
import RichTextEditor from './RichTextEditor'
import {
  getJSON,
  postJSON,
  delJSON,
} from '../services/api'

type Media = { url: string; type?: 'image' | 'video' }

type Post = {
  id: string
  animalId: string
  authorId?: string
  title: string
  body?: string
  media?: Media[]
  createdAt: string
  active?: boolean
}

const EMOJIS = ['🐾', '❤️', '😊', '🥰', '👏', '🎉', '😍', '🤗', '🌟', '👍']

export default function PostsSection({ animalId }: { animalId: string }) {
  const { hasAccess } = useAccess()
  const { role } = useAuth()

  // Staff can always see; regular users need unlock to READ
  const isStaff = role === 'ADMIN' || role === 'MODERATOR'
  const unlocked = isStaff || hasAccess(animalId)

  // Only staff are allowed to WRITE (add / delete posts)
  const canWrite = isStaff

  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  // Composer state
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [media, setMedia] = useState<Media[]>([])
  const [saving, setSaving] = useState(false)

  // Upload helpers
  const [uploading, setUploading] = useState(false)
  const [uploadNote, setUploadNote] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  async function refresh() {
    setErr(null)
    try {
      const list = await getJSON<Post[]>(`/api/posts/public?animalId=${encodeURIComponent(animalId)}`)
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

  function addEmoji(emoji: string) {
    setBody(prev => (prev ? `${prev} ${emoji}` : emoji))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canWrite) return
    if (!title.trim() && !body.trim() && media.length === 0) return
    setSaving(true)
    setErr(null)
    try {
      await postJSON('/api/posts', {
        animalId,
        title: title.trim() || 'Bez názvu',
        body: body.trim() || undefined, // HTML string from RichTextEditor
        media: media.length ? media.map(m => ({ url: m.url, typ: m.type || 'image' })) : undefined,
      })
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

  async function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter(f => f && f.size > 0)
    if (arr.length === 0) return
    setUploading(true)
    setErr(null)
    try {
      // Single-file uploads, one by one, to reuse /api/upload
      const now = Date.now()
      for (let i = 0; i < arr.length; i += 1) {
        const f = arr[i]
        setUploadNote(`Nahrávám ${i + 1} / ${arr.length}…`)
        const fd = new FormData()
        fd.append('file', f)
        const res = await fetch(
          (import.meta.env.VITE_API_BASE_URL || '') + '/api/upload',
          {
            method: 'POST',
            body: fd,
          }
        )
        if (!res.ok) {
          const txt = await res.text()
          console.error('[upload] failed', res.status, txt)
          throw new Error('Nahrání selhalo')
        }
        const json = await res.json()
        const url = String(json.url)
        setMedia(m => ([
          ...m,
          {
            url: `${url}${url.includes('?') ? '&' : '?'}v=${now}`,
            type: guessTypeFromUrl(url),
          },
        ]))
      }
    } catch (e: any) {
      console.error('[PostsSection] upload error', e)
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

  function removeMediaIndex(i: number) {
    setMedia(list => list.filter((_, idx) => idx !== i))
  }

  async function handleDelete(postId: string) {
    if (!canWrite) return
    const ok = window.confirm('Opravdu chcete tento příspěvek smazat?')
    if (!ok) return

    try {
      // 204 No Content on success – delJSON handles that correctly
      await delJSON<void>(`/api/posts/${encodeURIComponent(postId)}`)
      // Optimistic update
      setPosts(prev => prev.filter(p => p.id !== postId))
    } catch (e: any) {
      console.error('[PostsSection] delete error', e)
      setErr(e?.message || 'Smazání příspěvku selhalo.')
    }
  }

  return (
    <Box sx={{ mt: 5 }}>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
        Příspěvky
      </Typography>

      {err && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {err}
        </Alert>
      )}

      {!unlocked && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Příspěvky jsou viditelné po adopci. Dokončete adopci pro přístup k novinkám.
        </Alert>
      )}

      {loading ? (
        <Typography color="text.secondary">Načítám…</Typography>
      ) : posts.length === 0 ? (
        <Typography color="text.secondary">Zatím žádné příspěvky.</Typography>
      ) : (
        <Stack spacing={1.5} sx={{ mb: 3 }}>
          {posts.map(p => (
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
              {/* Delete button for staff */}
              {canWrite && (
                <IconButton
                  size="small"
                  onClick={() => handleDelete(p.id)}
                  sx={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    bgcolor: 'rgba(255,255,255,0.9)',
                    '&:hover': { bgcolor: 'rgba(255,255,255,1)' },
                  }}
                  aria-label="Smazat příspěvek"
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              )}

              <Typography sx={{ fontWeight: 700, mb: 0.5 }}>
                {p.title}
              </Typography>

              {p.media && p.media.length > 0 && (
                <Grid container spacing={1} sx={{ mb: 1 }}>
                  {p.media.map((m, i) => (
                    <Grid item xs={6} sm={4} md={3} key={`${m.url}-${i}`}>
                      <Box
                        component="a"
                        href={m.url}
                        target="_blank"
                        rel="noreferrer"
                        sx={{
                          display: 'block',
                          width: '100%',
                          height: 140,
                          borderRadius: 2,
                          overflow: 'hidden',
                          border: '1px solid',
                          borderColor: 'divider',
                        }}
                      >
                        <img
                          src={m.url}
                          alt={`post-media-${i}`}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              )}

              {/* body is HTML from RichTextEditor – render as-is */}
              {p.body && (
                <Typography
                  color="text.secondary"
                  sx={{ whiteSpace: 'pre-line' }}
                  dangerouslySetInnerHTML={{ __html: p.body }}
                />
              )}

              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 0.5 }}
              >
                {new Date(p.createdAt).toLocaleString()}
              </Typography>
            </Box>
          ))}
        </Stack>
      )}

      {/* Composer — visible to staff ONLY */}
      {canWrite && (
        <Box component="form" onSubmit={onSubmit} sx={{ mt: 2 }}>
          <Stack spacing={1.5}>
            {/* Media uploader */}
            <Stack spacing={1}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                Fotky / Videa
              </Typography>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                alignItems="center"
              >
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
                  {media.map((m, i) => (
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
                        <img
                          src={m.url}
                          alt={`new-media-${i}`}
                          style={{
                            width: '100%',
                            height: 140,
                            objectFit: 'cover',
                            display: 'block',
                          }}
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
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Stack>

            {/* Text inputs */}
            <TextField
              label="Titulek"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required={!body && media.length === 0}
            />
            <RichTextEditor
              label="Text"
              value={body}
              onChange={setBody}
              helperText="Můžete použít tučné, kurzívu, podtržení a barvu (tyrkysová)."
            />

            {/* Emoji row (inline append) */}
            <Stack
              direction="row"
              spacing={1}
              sx={{ flexWrap: 'wrap', mt: 1 }}
            >
              {EMOJIS.map(emo => (
                <Button
                  key={emo}
                  size="small"
                  variant="text"
                  onClick={() => addEmoji(emo)}
                  sx={{ minWidth: 36 }}
                >
                  {emo}
                </Button>
              ))}
            </Stack>

            <Button
              type="submit"
              variant="contained"
              disabled={saving || uploading}
            >
              {saving ? 'Ukládám…' : 'Přidat příspěvek'}
            </Button>
          </Stack>
        </Box>
      )}
    </Box>
  )
}

/* Helpers */
function guessTypeFromUrl(u: string): 'image' | 'video' | undefined {
  const lc = u.toLowerCase()
  if (/\.(mp4|webm|mov|m4v)(\?|$)/.test(lc)) return 'video'
  if (/\.(jpg|jpeg|png|gif|webp|avif)(\?|$)/.test(lc)) return 'image'
  return undefined
}