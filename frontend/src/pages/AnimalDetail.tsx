import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Container, Typography, Box, Button, Grid, Stack, Alert
} from '@mui/material'
import { fetchAnimal, hasAccessForAnimal, startAdoption } from '../services/api'
import { useAccess } from '../context/AccessContext'
import { useAuth } from '../context/AuthContext'
import PostsSection from '../components/PostsSection'

interface Media { url: string }
interface Animal {
  id: string
  name: string
  description: string
  galerie: Media[]
}

const AnimalDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const [animal, setAnimal] = useState<Animal | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const { hasAccess, grantAccess } = useAccess()
  const auth = useAuth()
  const nav = useNavigate()

  useEffect(() => {
    async function load() {
      try {
        const a = id ? await fetchAnimal(id) : null
        setAnimal(a as any)
        if (id) {
          const res = await hasAccessForAnimal(id)
          if (res.access) grantAccess(id)
        }
      } catch (e: any) {
        setError(e.message || 'Chyba při načítání zvířete')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, grantAccess, hasAccess])

  if (loading) return <Typography>Načítání...</Typography>
  if (error) return <Alert severity="error">{error}</Alert>
  if (!animal) return <Typography>Zvíře nenalezeno</Typography>

  const unlocked = id ? hasAccess(id) : false

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h3" gutterBottom>{animal.name}</Typography>
      <Typography variant="body1" gutterBottom>{animal.description}</Typography>

      <Box mt={4}>
        <Typography variant="h6">Galerie</Typography>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          {animal.galerie.map((g, idx) => (
            <Grid key={idx} item xs={6} sm={4}>
              <Box sx={{
                filter: unlocked ? 'none' : 'blur(8px)',
                borderRadius: 2,
                overflow: 'hidden',
                position: 'relative'
              }}>
                <img src={g.url} alt={`obrázek ${idx + 1}`} style={{ width: '100%', height: 120, objectFit: 'cover' }} />
                {!unlocked && (
                  <Box sx={{
                    position: 'absolute',
                    inset: 0,
                    bgcolor: 'rgba(0,0,0,0.3)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    Zamčeno (odemčete po adopci)
                  </Box>
                )}
              </Box>
            </Grid>
          ))}
        </Grid>
      </Box>

      {!unlocked ? (
        <Stack direction="row" spacing={2} sx={{ mt: 4 }}>
          <Button
            variant="contained"
            onClick={async () => {
              if (!auth.token) {
                nav('/moderator/login', { state: { from: { pathname: `/zvirata/${id}` } } })
                return
              }
              try {
                await startAdoption(id!)
                grantAccess(id!)
              } catch (e: any) {
                setError(e.message || 'Adopce selhala')
              }
            }}
          >
            Chci adoptovat
          </Button>
        </Stack>
      ) : null}
      {animal.id && <PostsSection animalId={animal.id} />}
    </Container>
  )
}

export default AnimalDetail