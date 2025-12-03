// frontend/src/pages/ModeratorNewPost.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  Container,
  Typography,
  Stack,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Box,
  LinearProgress,
  Grid,
  IconButton,
  Tooltip,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import UploadIcon from '@mui/icons-material/UploadFile'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import DeleteIcon from '@mui/icons-material/Delete'
import RichTextEditor from '../components/RichTextEditor'

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

type AnimalOption = {
  id: string
  jmeno?: string
  name?: string
}

type MediaItem = {
  url: string
  type?: 'image' | 'video'
}

const EMOJIS = ['🐾', '❤️', '😊', '🥰', '👏', '🎉', '😍', '🤗', '🌟', '👍']

export default function ModeratorNewPost() {
  const navigate = useNavigate()

  const [animals, setAnimals] = useState<AnimalOption[]>([])
  const [loadingAnimals, setLoadingAnimals] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [animalId, setAnimalId] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  const [media, setMedia] = useState<MediaItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadNote, setUploadNote] = useState('')

  const [saving, setSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  /** Načtení seznamu zvířat pro dropdown */
  const loadAnimals = useCallback(async () => {
    try {
      setLoadingAnimals(true)
      setError(null)

      const token = sessionStorage.getItem('accessToken')
      if (!token) {
        setError('Nejste přihlášen jako moderátor. Přihlaste se prosím znovu.')
        return
      }

      const res = await fetch(`${API_BASE}/animals?active=true`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        throw new Error(`Načtení zvířat selhalo: ${res.status}`)
      }

      const data = await res.json()
      setAnimals(data || [])
    } catch (e: any) {
      console.error('[ModeratorNewPost] loadAnimals error', e)
      setError(e?.message || 'Nepodařilo se načíst zvířata.')
    } finally {
      setLoadingAnimals(false)
    }
  }, [])

  useEffect(() => {
    loadAnimals()
  }, [loadAnimals])

  /** Přidání emoji do textu */
  function addEmoji(emoji: string) {
    setBody((prev) => (prev ? `${prev} ${emoji}` : emoji))
  }

  /** Upload souborů (fotky / videa) na backend (/api/upload) */
  async function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f && f.size > 0)
    if (arr.length === 0) return

    setUploading(true)
    setError(null)

    try {
      const uploaded: MediaItem[] = []

      for (let i = 0; i < arr.length; i += 1) {
        const f = arr[i]
        setUploadNote(`Nahrávám ${i + 1} / ${arr.length}…`)

        const fd = new FormData()
        fd.append('file', f)

        const token = sessionStorage.getItem('accessToken') || ''

        const res = await fetch(`${API_BASE}/upload`, {
          method: 'POST',
          headers: {
            // necháme Content-Type na browseru (FormData)
            Authorization: token ? `Bearer ${token}` : '',
          },
          body: fd,
        })

        if (!res.ok) {
          const txt = await res.text()
          console.error('[ModeratorNewPost] upload error', res.status, txt)
          throw new Error('Nahrání souboru selhalo')
        }

        const json = await res.json()
        const data = json?.data || json

        const rawUrl: string =
          data?.url ||
          (data?.key
            ? `${data.publicBase || ''}${data.key}`
            : '')

        if (!rawUrl) continue

        const urlWithBust = appendBust(rawUrl)
        uploaded.push({
          url: urlWithBust,
          type: guessTypeFromUrl(rawUrl),
        })
      }

      if (uploaded.length > 0) {
        setMedia((prev) => [...prev, ...uploaded])
      }
    } catch (e: any) {
      console.error('[ModeratorNewPost] handleFiles error', e)
      setError(e?.message || 'Nahrání souborů selhalo.')
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
    setMedia((list) => list.filter((_, idx) => idx !== i))
  }

  /** Uložení příspěvku */
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)

    if (!animalId) {
      setError('Vyberte prosím zvíře.')
      return
    }
    if (!title.trim()) {
      setError('Zadejte prosím titulek příspěvku.')
      return
    }
    if (!body.trim() && media.length === 0) {
      setError('Text příspěvku nebo fotka/video nesmí být prázdné.')
      return
    }

    const token = sessionStorage.getItem('accessToken')
    if (!token) {
      setError('Nejste přihlášen jako moderátor. Přihlaste se prosím znovu.')
      return
    }

    try {
      setSaving(true)

      const res = await fetch(`${API_BASE}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          animalId,
          title: title.trim(),
          body, // HTML z RichTextEditoru
          media: media.length ? media : undefined,
        }),
      })

      if (!res.ok) {
        const txt = await res.text()
        console.error('[ModeratorNewPost] save error', res.status, txt)
        throw new Error('Nepodařilo se uložit příspěvek.')
      }

      setSuccessMessage('Příspěvek byl uložen.')
      setTitle('')
      setBody('')
      setMedia([])
    } catch (e: any) {
      setError(e?.message || 'Nepodařilo se uložit příspěvek.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 3 }}
      >
        <Typography variant="h5" sx={{ fontWeight: 900 }}>
          Nový příspěvek
        </Typography>
        <Button variant="outlined" onClick={() => navigate('/moderator')}>
          Zpět na panel
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {successMessage}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSave}>
        {/* výběr zvířete */}
        <FormControl fullWidth margin="normal" disabled={loadingAnimals}>
          <InputLabel id="animal-select-label">Zvíře</InputLabel>
          <Select
            labelId="animal-select-label"
            label="Zvíře"
            value={animalId}
            onChange={(e) => setAnimalId(e.target.value)}
          >
            {animals.map((a) => (
              <MenuItem key={a.id} value={a.id}>
                {a.jmeno || a.name || a.id}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* titulek */}
        <TextField
          label="Titulek"
          fullWidth
          margin="normal"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        {/* text příspěvku */}
        <Box sx={{ mt: 2 }}>
          <RichTextEditor
            label="Text příspěvku"
            value={body}
            onChange={setBody}
            helperText="Můžete použít tučné, kurzívu, podtržení a barvu (tyrkysová)."
          />
        </Box>

        {/* emoji řádek */}
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mt: 1 }}>
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

        {/* upload fotek / videí */}
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
            Fotky / videa (volitelné)
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
              mt: 2,
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
                      alt={`media-${i}`}
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
        </Box>

        <Button
          type="submit"
          variant="contained"
          sx={{ mt: 3 }}
          disabled={saving || uploading}
        >
          {saving ? 'Ukládám…' : 'Uložit příspěvek'}
        </Button>
      </Box>
    </Container>
  )
}

/* Helpers */

function appendBust(url: string): string {
  const v = Date.now()
  return `${url}${url.includes('?') ? '&' : '?'}v=${v}`
}

function guessTypeFromUrl(u: string): 'image' | 'video' | undefined {
  const lc = u.toLowerCase()
  if (/\.(mp4|webm|mov|m4v)(\?|$)/.test(lc)) return 'video'
  if (/\.(jpg|jpeg|png|gif|webp|avif)(\?|$)/.test(lc)) return 'image'
  return undefined
}