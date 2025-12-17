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
import { getJSON, postJSON, delJSON } from '../services/api'

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
      const list = await getJSON<Post[]>(
        `/api/posts/public?animalId=${encodeURIComponent(animalId)}`
      )
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
    setBody((prev) => (prev ? `${prev} ${emoji}` : emoji))
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
        body: body.trim() || undefined,
        media: media.length
          ? media.map((m) => ({ url: m.url, typ: m.type || 'image' }))
          : undefined,
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
    const arr = Array.from(files).filter((f) => f && f.size > 0)
    if (arr.length === 0) return
    setUploading(true)
    setErr(null)
    try {
      const now = Date.now()
      for (let i = 0; i < arr.length; i += 1) {
        const f = arr[i]
        setUploadNote(`Nahrávám ${i + 1} / ${arr.length}…`)
        const fd = new FormData()
        fd.append('file', f)
        const res = await fetch(
          (import.meta.env.VITE_API_BASE_URL || '') + '/api/upload',
          { method: 'POST', body: fd }
        )
        if (!res.ok) throw new Error('Nahrání selhalo')
        const json = await res.json()
        const url = String(json.url)
        setMedia((m) => [
          ...m,
          {
            url: `${url}${url.includes('?') ? '&' : '?'}v=${now}`,
            type: guessTypeFromUrl(url),
          },
        ])
      }
    } catch (e: any) {
      setErr(e?.message || 'Nahrání selhalo')
    } finally {
      setUploading(false)
      setUploadNote('')
    }
  }

  function handleDelete(postId: string) {
    if (!canWrite) return
    if (!window.confirm('Opravdu chcete tento příspěvek smazat?')) return

    delJSON<void>(`/api/posts/${encodeURIComponent(postId)}`)
      .then(() => setPosts((prev) => prev.filter((p) => p.id !== postId)))
      .catch((e: any) =>
        setErr(e?.message || 'Smazání příspěvku selhalo.')
      )
  }

  return (
    <Box sx={{ mt: 5 }}>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
        Příspěvky
      </Typography>

      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      {!unlocked && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Příspěvky jsou viditelné po adopci.
        </Alert>
      )}

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
              {canWrite && (
                <IconButton
                  size="small"
                  onClick={() => handleDelete(p.id)}
                  sx={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    bgcolor: 'rgba(255,255,255,0.9)',
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              )}

              {/* TITLE */}
              <Typography sx={{ fontWeight: 700 }}>
                {p.title}
              </Typography>

              {/* DATE directly under title */}
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mb: 1 }}
              >
                {new Date(p.createdAt).toLocaleDateString('cs-CZ')}
              </Typography>

              {/* MEDIA */}
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
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              )}

              {/* BODY */}
              {p.body && (
                <Typography
                  color="text.secondary"
                  dangerouslySetInnerHTML={{ __html: p.body }}
                />
              )}
            </Box>
          ))}
        </Stack>
      )}

      {/* Composer (staff only) */}
      {canWrite && (
        <Box component="form" onSubmit={onSubmit} sx={{ mt: 2 }}>
          <Stack spacing={1.5}>
            <TextField
              label="Titulek"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <RichTextEditor
              label="Text"
              value={body}
              onChange={setBody}
            />

            <Stack direction="row" spacing={1} flexWrap="wrap">
              {EMOJIS.map((emo) => (
                <Button
                  key={emo}
                  size="small"
                  onClick={() => addEmoji(emo)}
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