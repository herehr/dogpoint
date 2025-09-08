import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Container, Typography, Box, Stack, Chip, Alert, Skeleton, Grid, Button, Divider
} from '@mui/material'
import { fetchAnimal } from '../services/api'
import { useAccess } from '../context/AccessContext'
import PostsSection from '../components/PostsSection'
import BlurBox from '../components/BlurBox'
import ReactionBar from '../components/ReactionBar'
import AdoptionDialog from '../components/AdoptionDialog'

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
  const navigate = useNavigate()
  const { hasAccess, grantAccess } = useAccess()

  const [animal, setAnimal] = useState<LocalAnimal | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [adoptOpen, setAdoptOpen] = useState(false)
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
  if (!animal || !id) return null

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

      {/* Main photo & description (always visible) */}
      <Box sx={{ mt: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Box
              component="a"
              href={media[0]?.url}
              target="_blank"
              rel="noreferrer"
              sx={{ display: 'block', borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}
            >
              <img
                src={media[0]?.url}
                alt="main"
                style={{ width: '100%', height: 320, objectFit: 'cover' }}
              />
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
              Popis
            </Typography>
            <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
              {animal.popis || 'Bez popisu.'}
            </Typography>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
              Reakce (viditelné jen pro vás)
            </Typography>
            <ReactionBar animalId={id} />

            <Divider sx={{ my: 2 }} />

            {!unlocked && (
              <Box id="adopce">
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                  Chci adoptovat
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                  Po adopci uvidíte další fotografie, videa a příspěvky.
                </Typography>
                <Button variant="contained" onClick={() => setAdoptOpen(true)}>
                  Pokračovat k adopci
                </Button>
              </Box>
            )}
          </Grid>
        </Grid>
      </Box>

      {/* Additional gallery (blurred until unlock) */}
      {media.length > 1 && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
            Další fotografie a videa
          </Typography>
          <BlurBox blurred={!unlocked}>
            <Grid container spacing={1.5}>
              {media.slice(1).map((m, i) => (
                <Grid item xs={6} sm={4} md={3} key={i}>
                  <Box
                    component="a"
                    href={m.url}
                    target="_blank"
                    rel="noreferrer"
                    sx={{
                      display: 'block',
                      width: '100%',
                      height: 160,
                      borderRadius: 2,
                      overflow: 'hidden',
                      border: '1px solid',
                      borderColor: 'divider'
                    }}
                  >
                    <img
                      src={m.url}
                      alt={`media-${i+1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </Box>
                </Grid>
              ))}
            </Grid>
          </BlurBox>
          {!unlocked && (
            <Typography variant="caption" color="text.secondary">
              Zamčeno – odemkne se po adopci.
            </Typography>
          )}
        </Box>
      )}

      {/* Posts (locked until adoption) */}
      <Box id="posts" sx={{ mt: 4 }}>
        <PostsSection animalId={animal.id} />
      </Box>

      {/* Adoption dialog */}
      <AdoptionDialog
        open={adoptOpen}
        onClose={() => setAdoptOpen(false)}
        animalId={id}
        onGranted={() => grantAccess(id)}
      />
    </Container>
  )
}