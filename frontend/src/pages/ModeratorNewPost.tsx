// frontend/src/pages/ModeratorNewPost.tsx
import React, { useEffect, useRef, useState } from 'react'
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
} from '@mui/material'
import UploadIcon from '@mui/icons-material/UploadFile'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import RichTextEditor from '../components/RichTextEditor'
import { fetchAnimals, type Animal, uploadMedia } from '../api'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

type PostMedia = { url: string; type?: 'image' | 'video' }

const EMOJIS = ['🐾', '❤️', '😊', '🥰', '👏', '🎉', '😍', '🤗', '🌟', '👍']

export default function ModeratorNewPost() {
  const navigate = useNavigate()
  const { token } = useAuth()

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

  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const list = await fetchAnimals()
        setAnimals(list)
      } catch (e: any) {
        setError(e?.message || 'Nepodařilo se načíst seznam zvířat')
      }
    })()
  }, [])

  /* ---------- Upload helpers ---------- */

  async function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f && f.size > 0)
    if (!arr.length) return
    setUploading(true)
    setError(null)
    try {
      const results: string[] = []
      for (let i = 0; i < arr.length; i++) {
        setUploadNote(`Nahrávám ${i + 1} / ${arr.length}…`)
        // eslint-disable-next-line no-await-in-loop
        const one = await uploadMedia(arr[i])
        const url = (one as any)?.url || (one as any)?.key || ''
        if (url) results.push(url)
      }
      const now = Date.now()
      setMedia((cur) => [
        ...cur,
        ...results.map((u) => ({
          url: `${u}${u.includes('?') ? '&' : '?'}v=${now}`,
          type: guessTypeFromUrl(u) || 'image',
        })),
      ])
    } catch (e: any) {
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

  function removeMedia(idx: number) {
    setMedia((list) => list.filter((_, i) => i !== idx))
  }

  function addEmoji(emoji: string) {
    setBody((prev) => (prev ? `${prev} ${emoji}` : emoji))
  }

  /* ---------- SAVE ---------- */

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setOk(null)

    if (!token) {
      setError('Nejste přihlášen jako moderátor / admin.')
      return
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
              typ: m.type || guessTypeFromUrl(m.url) || 'image',
            }))
          : undefined,
      }

      // 🔴 BUG BEFORE: calling `${API_BASE_URL}/posts` (=> /posts 404)
      // ✅ FIX: use /api/posts + Authorization
      const res = await fetch(`${API_BASE_URL}/api/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const text = await res.text()
        console.error('[ModeratorNewPost] save error', res.status, text)
        throw new Error(
          `Uložení selhalo (HTTP ${res.status}): ${
            text || 'Neznámá chyba'
          }`,
        )
      }

      setOk('Příspěvek uložen. Pokud jste moderátor, čeká na schválení.')
      setTitle('')
      setBody('')
      setMedia([])
      // optional: navigate back after short delay
      // setTimeout(() => navigate('/moderator/animals?tab=pending'), 800)
    } catch (e: any) {
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
            SelectProps={{ native: true }}
            label="Zvíře"
            value={animalId}
            onChange={(e) => setAnimalId(e.target.value)}
            required
            fullWidth
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
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
          />

          <RichTextEditor
            label="Text příspěvku"
            value={body}
            onChange={(val) => setBody(val)}
            helperText="Napište, co je nového – můžete použít formátování."
          />

          {/* Emoji bar */}
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            {EMOJIS.map((emo) => (
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

          {/* Media uploader */}
          <Stack spacing={1}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              Fotky / videa
            </Typography>

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              alignItems="center"
            >
              <Button
                onClick={() => fileRef.current?.click()}
                startIcon={<UploadIcon />}
                variant="outlined"
              >
                Vybrat soubory
              </Button>
              <input
                ref={fileRef}
                type="file"
                hidden
                multiple
                accept="image/*,video/*"
                onChange={onPickFiles}
              />

              <Button
                onClick={() => cameraRef.current?.click()}
                startIcon={<PhotoCameraIcon />}
                variant="outlined"
              >
                Vyfotit (telefon)
              </Button>
              <input
                ref={cameraRef}
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
                        alt={`post-media-${i}`}
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
                ))}
              </Grid>
            )}
          </Stack>

          <Stack direction="row" spacing={2} justifyContent="flex-end">
            <Button
              variant="text"
              onClick={() => navigate('/moderator/animals?tab=pending')}
            >
              Zpět
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={loading || uploading}
            >
              {loading ? 'Ukládám…' : 'Uložit příspěvek'}
            </Button>
          </Stack>
        </Stack>
      </form>
    </Container>
  )
}

function guessTypeFromUrl(u: string): 'image' | 'video' | undefined {
  const lc = u.toLowerCase()
  if (/\.(mp4|webm|mov|m4v)(\?|$)/.test(lc)) return 'video'
  if (/\.(jpg|jpeg|png|gif|webp|avif)(\?|$)/.test(lc)) return 'image'
  return undefined
}