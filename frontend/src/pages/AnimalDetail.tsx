// frontend/src/pages/AnimalDetail.tsx
import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Container, Typography, Box, Stack, Chip, Alert, Skeleton, Grid, Button
} from '@mui/material'
import { fetchAnimal, startAdoption } from '../services/api'
import { useAccess } from '../context/AccessContext'
import PostsSection from '../components/PostsSection'

type Media = { url: string; type?: 'image'|'video' }
type LocalAnimal = {
  id: string
  jmeno: string
  druh?: 'pes'|'kočka'|'jiné'
  vek?: string
  popis?: string
  main?: string
  galerie?: Media[]
  active?: boolean
}

export default function AnimalDetail() {
  const { id } = useParams()
  const { hasAccess, grantAccess } = useAccess()

  const [animal, setAnimal] = useState<LocalAnimal | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [adopting, setAdopting] = useState(false)
  const unlocked = id ? hasAccess(id) : false

  useEffect(() => {
    let alive = true
    if (!id) return
    setLoading(true); setErr(null)
    fetchAnimal(id)
      .then(a => { if (alive) setAnimal(a as any) })
      .catch(e => alive && setErr(e?.message || 'Chyba načítání detailu'))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [id])

  async function onAdopt() {
    if (!id) return
    setAdopting(true); setErr(null)
    try {
      await startAdoption(id)         // MVP: server grants access immediately
      grantAccess(id)                 // unlock posts locally
      setTimeout(() => {
        document.getElementById('posts')?.scrollIntoView({ behavior: 'smooth' })
      }, 50)
    } catch (e: any) {
      setErr(e?.message || 'Zahájení adopce selhalo')
    } finally {
      setAdopting(false)
    }
  }

  if (loading) {
    return (
      <Container sx={{ py: 4 }}>
        <Skeleton variant="text" width={280} height={40} />
        <Skeleton variant="rectangular" height={320} sx={{ mt: 2 }} />
      </Container>
    )
  }
  if (err) {
    return (
      <Container sx={{ py: 4 }}>
        <Alert severity="error">{err}</Alert>
      </Container>
    )
  }
  if (!animal) return null

  const kind = animal.druh === 'pes' ? 'Pes' : animal.druh === 'kočka' ? 'Kočka' : 'Jiné'
  const age = animal.vek || 'neuvedeno'
  const media = (animal.galerie || []).length ? (animal.galerie || []) : [{ url: animal.main || '/no-image.jpg' }]

  return (
    <Container sx={{ py: 4 }}>
      {/* Header */}
      <Stack spacing={1.5}>
        <Typography variant="h4" sx={{ fontWeight: 900 }}>{animal.jmeno}</Typography>
        <Stack direction="row" spacing={1}>
          <Chip label={kind} />
          <Chip label={age} />
        </Stack>
      </Stack>

      {/* Gallery — ALWAYS visible */}
      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
          Galerie
        </Typography>
        {media.length === 0 ? (
          <Typography color="text.secondary">Žádné fotografie.</Typography>
        ) : (
          <Grid container spacing={1.5}>
            {media.map((m, i) => (
              <Grid item xs={6} sm={4} md={3} key={i}>
                <Box
                  component="a"
                  href={m.url}
                  target="_blank"
                  rel="noreferrer"
                  sx={{
                    display: 'block',
                    width: '100%',
                    height: 180,
                    borderRadius: 2,
                    overflow: 'hidden',
                    border: '1px solid',
                    borderColor: 'divider'
                  }}
                >
                  <img
                    src={m.url}
                    alt={`media-${i}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </Box>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      {/* Description */}
      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
          Popis
        </Typography>
        <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
          {animal.popis || 'Bez popisu.'}
        </Typography>
      </Box>

      {/* Adoption CTA (to unlock POSTS only) */}
      {!unlocked && (
        <Box id="adopce" sx={{
          mt: 3, p: 2, border: '1px dashed', borderColor: 'divider',
          borderRadius: 2, background: '#fffef7'
        }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
            Chci adoptovat
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Po úspěšné adopci se zpřístupní část „Příspěvky“ (novinky, videa a fotky od pečovatelů).
          </Typography>
          <Button variant="contained" onClick={onAdopt} disabled={adopting}>
            {adopting ? 'Zpracovávám…' : 'Pokračovat k adopci'}
          </Button>
        </Box>
      )}

      {/* Posts (locked until adoption) */}
      <Box id="posts">
        <PostsSection animalId={animal.id} />
      </Box>
    </Container>
  )
}