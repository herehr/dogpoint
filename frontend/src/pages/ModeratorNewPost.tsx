// frontend/src/pages/ModeratorNewPost.tsx
import React, { useEffect, useState } from 'react'
import {
  Container,
  Typography,
  TextField,
  Stack,
  Button,
  Alert,
  Box,
  MenuItem,
  CircularProgress,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import RichTextEditor from '../components/RichTextEditor'
import { fetchAnimals } from '../api' // 👈 use same helper as /zvirata

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

type Animal = {
  id: string
  jmeno?: string
  name?: string
  active?: boolean
}

export default function ModeratorNewPost() {
  const [animalId, setAnimalId] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [animals, setAnimals] = useState<Animal[]>([])
  const [animalsLoading, setAnimalsLoading] = useState(true)
  const [animalsError, setAnimalsError] = useState<string | null>(null)

  const navigate = useNavigate()

  // Load animals for dropdown using the same API helper as /zvirata
  useEffect(() => {
    let cancelled = false

    const loadAnimals = async () => {
      setAnimalsLoading(true)
      setAnimalsError(null)

      try {
        const data = (await fetchAnimals()) as Animal[]

        if (cancelled) return

        const activeAnimals = (data || []).filter((a) => a.active !== false)
        setAnimals(activeAnimals)

        if (activeAnimals.length > 0 && !animalId) {
          setAnimalId(activeAnimals[0].id)
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('[ModeratorNewPost] loadAnimals failed', err)
          setAnimalsError(err?.message || 'Nepodařilo se načíst zvířata.')
        }
      } finally {
        if (!cancelled) setAnimalsLoading(false)
      }
    }

    loadAnimals()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!animalId || !title || !body) {
      setError('Vyplňte prosím zvíře, titulek a text příspěvku.')
      return
    }

    setLoading(true)
    try {
      const token =
        sessionStorage.getItem('moderatorToken') ||
        localStorage.getItem('moderatorToken') ||
        localStorage.getItem('token') ||
        ''

      const res = await fetch(`${API_BASE}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ animalId, title, body }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.message || `Chyba ${res.status}`)
      }

      setSuccess('Příspěvek byl úspěšně uložen.')
      setBody('')
      // animalId & title necháme pro další příspěvky
    } catch (err: any) {
      console.error('[ModeratorNewPost] create post failed', err)
      setError(err?.message || 'Nepodařilo se uložit příspěvek.')
    } finally {
      setLoading(false)
    }
  }

  const selectedAnimal = animals.find((a) => a.id === animalId) || null

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
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

      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">{success}</Alert>}

          {/* Zvíře – dropdown aktivních zvířat */}
          <TextField
            select
            fullWidth
            label="Zvíře"
            value={animalId}
            onChange={(e) => setAnimalId(e.target.value)}
            disabled={animalsLoading || !!animalsError}
            helperText={
              animalsError
                ? animalsError
                : selectedAnimal
                ? `Vybráno: ${selectedAnimal.jmeno || selectedAnimal.name || selectedAnimal.id}`
                : 'Vyberte zvíře, ke kterému chcete přidat příspěvek.'
            }
          >
            {animalsLoading && (
              <MenuItem value="" disabled>
                <CircularProgress size={20} sx={{ mr: 1 }} /> Načítám zvířata…
              </MenuItem>
            )}

            {!animalsLoading && animals.length === 0 && !animalsError && (
              <MenuItem value="" disabled>
                Žádná aktivní zvířata.
              </MenuItem>
            )}

            {animals.map((a) => {
              const label = a.jmeno || a.name || a.id
              return (
                <MenuItem key={a.id} value={a.id}>
                  {label} 
                </MenuItem>
              )
            })}
          </TextField>

          {/* Titulek */}
          <TextField
            label="Titulek"
            fullWidth
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          {/* Rich text – tučné, kurzíva, podtržení, tyrkysová */}
          <RichTextEditor
            label="Text příspěvku"
            value={body}
            onChange={setBody}
            helperText="Můžete použít tučné, kurzívu, podtržení a barvu (např. tyrkysová)."
          />

          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? 'Ukládám…' : 'Uložit příspěvek'}
          </Button>
        </Stack>
      </Box>
    </Container>
  )
}