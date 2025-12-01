// frontend/src/pages/ModeratorPosts.tsx
import React, { useEffect, useState, useCallback } from 'react'
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
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import RichTextEditor from '../components/RichTextEditor'

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

type AnimalOption = {
  id: string
  jmeno?: string
  name?: string
}

export default function ModeratorPosts() {
  const navigate = useNavigate()

  const [animals, setAnimals] = useState<AnimalOption[]>([])
  const [loadingAnimals, setLoadingAnimals] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [animalId, setAnimalId] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  const [saving, setSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const loadAnimals = useCallback(async () => {
    try {
      setLoadingAnimals(true)
      setError(null)

      const token = sessionStorage.getItem('moderatorToken')
      if (!token) {
        setError('Nejste přihlášen jako moderátor. Přihlaste se prosím znovu.')
        return
      }

      const res = await fetch(`${API_BASE}/animals`, {
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
      console.error('[ModeratorPosts] loadAnimals error', e)
      setError(e?.message || 'Nepodařilo se načíst zvířata.')
    } finally {
      setLoadingAnimals(false)
    }
  }, [])

  useEffect(() => {
    loadAnimals()
  }, [loadAnimals])

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
    if (!body.trim()) {
      setError('Text příspěvku nesmí být prázdný.')
      return
    }

    const token = sessionStorage.getItem('moderatorToken')
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
        }),
      })

      if (!res.ok) {
        const txt = await res.text()
        console.error('[ModeratorPosts] save error', res.status, txt)
        throw new Error('Nepodařilo se uložit příspěvek.')
      }

      setSuccessMessage('Příspěvek byl uložen.')
      setTitle('')
      setBody('')
    } catch (e: any) {
      setError(e?.message || 'Nepodařilo se uložit příspěvek.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
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

        <TextField
          label="Titulek"
          fullWidth
          margin="normal"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <Box sx={{ mt: 2 }}>
          <RichTextEditor
            label="Text příspěvku"
            value={body}
            onChange={setBody}
            helperText="Můžete použít tučné, kurzívu, podtržení a barvu (tyrkysová) pro zvýraznění."
          />
        </Box>

        <Button
          type="submit"
          variant="contained"
          sx={{ mt: 3 }}
          disabled={saving}
        >
          {saving ? 'Ukládám...' : 'Uložit příspěvek'}
        </Button>
      </Box>
    </Container>
  )
}