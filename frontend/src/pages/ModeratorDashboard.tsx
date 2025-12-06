// frontend/src/pages/ModeratorDashboard.tsx
import React, { useEffect, useState, SyntheticEvent } from 'react'
import {
  Box,
  Tabs,
  Tab,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Stack,
  Chip,
} from '@mui/material'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

type AnimalStatus = 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED'

interface GalerieItem {
  url: string
  typ: string
}

interface Animal {
  id: string
  jmeno?: string | null
  name?: string | null
  main?: string | null
  charakteristik?: string | null
  popis?: string | null
  active: boolean
  status: AnimalStatus
  galerie?: GalerieItem[]
  createdAt?: string
}

type TabKey = 'published' | 'pending'

const ModeratorDashboard: React.FC = () => {
  const [tab, setTab] = useState<TabKey>('published')
  const [animals, setAnimals] = useState<Animal[]>([])
  const [pendingAnimals, setPendingAnimals] = useState<Animal[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const token = typeof window !== 'undefined'
    ? sessionStorage.getItem('moderatorToken')
    : null

  const authHeaders: HeadersInit = token
    ? { Authorization: `Bearer ${token}` }
    : {}

  const fetchPublishedAnimals = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`${API_BASE_URL}/api/animals?active=true`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: Animal[] = await res.json()
      setAnimals(data)
    } catch (e: any) {
      console.error('fetchPublishedAnimals error', e)
      setError('Nepodařilo se načíst schválená zvířata.')
    } finally {
      setLoading(false)
    }
  }

  const fetchPendingAnimals = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`${API_BASE_URL}/api/animals/pending`, {
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
      })
      if (res.status === 401 || res.status === 403) {
        setError('Nemáte oprávnění zobrazit čekající zvířata.')
        setPendingAnimals([])
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: Animal[] = await res.json()
      setPendingAnimals(data)
    } catch (e: any) {
      console.error('fetchPendingAnimals error', e)
      setError('Nepodařilo se načíst zvířata ke schválení.')
    } finally {
      setLoading(false)
    }
  }

  const handleTabChange = (_event: SyntheticEvent, newValue: TabKey) => {
    setTab(newValue)
  }

  const handleApproveAnimal = async (id: string) => {
    if (!token) {
      alert('Nejste přihlášen jako moderátor / admin.')
      return
    }
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`${API_BASE_URL}/api/moderation/animals/${id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
      })
      if (res.status === 401 || res.status === 403) {
        setError('Nemáte oprávnění schválit toto zvíře.')
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      // Po úspěchu znovu načíst seznamy
      await Promise.all([fetchPublishedAnimals(), fetchPendingAnimals()])
    } catch (e: any) {
      console.error('approve animal error', e)
      setError('Nepodařilo se schválit zvíře.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Při načtení dashboardu: stáhnout oboje
    fetchPublishedAnimals()
    fetchPendingAnimals()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const renderAnimalCard = (animal: Animal, isPending: boolean) => {
    const name = animal.jmeno || animal.name || 'Bez jména'
    const img = animal.main || animal.galerie?.[0]?.url
    const statusLabel =
      animal.status === 'PENDING_REVIEW'
        ? 'Čeká na schválení'
        : animal.status === 'PUBLISHED'
        ? 'Schváleno'
        : animal.status === 'DRAFT'
        ? 'Koncept'
        : 'Odmítnuto'

    const statusColor =
      animal.status === 'PENDING_REVIEW'
        ? 'warning'
        : animal.status === 'PUBLISHED'
        ? 'success'
        : animal.status === 'REJECTED'
        ? 'error'
        : 'default'

    return (
      <Card key={animal.id} sx={{ mb: 2 }}>
        {img && (
          <Box
            component="img"
            src={img}
            alt={name}
            sx={{ width: '100%', maxHeight: 240, objectFit: 'cover' }}
          />
        )}
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="h6">{name}</Typography>
            <Chip label={statusLabel} color={statusColor as any} size="small" />
          </Stack>
          {animal.charakteristik && (
            <Typography variant="body2" color="text.secondary">
              {animal.charakteristik.replace(/<[^>]+>/g, '').slice(0, 160)}…
            </Typography>
          )}
        </CardContent>
        <CardActions sx={{ justifyContent: 'flex-end' }}>
          {isPending && (
            <Button
              variant="contained"
              size="small"
              onClick={() => handleApproveAnimal(animal.id)}
            >
              Schválit
            </Button>
          )}
          {/* You can add Edit / Delete buttons here if you already have them */}
        </CardActions>
      </Card>
    )
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom>
        Moderátorský přehled
      </Typography>

      <Tabs
        value={tab}
        onChange={handleTabChange}
        sx={{ mb: 2 }}
        textColor="primary"
        indicatorColor="primary"
      >
        <Tab value="published" label="Schválená zvířata" />
        <Tab value="pending" label="Zvířata ke schválení" />
      </Tabs>

      {loading && (
        <Typography variant="body2" sx={{ mb: 2 }}>
          Načítám…
        </Typography>
      )}

      {error && (
        <Typography variant="body2" color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      {tab === 'published' && (
        <Box>
          {animals.length === 0 ? (
            <Typography variant="body2">Žádná schválená zvířata.</Typography>
          ) : (
            animals.map((a) => renderAnimalCard(a, false))
          )}
        </Box>
      )}

      {tab === 'pending' && (
        <Box>
          {pendingAnimals.length === 0 ? (
            <Typography variant="body2">Žádná zvířata nečekají na schválení.</Typography>
          ) : (
            pendingAnimals.map((a) => renderAnimalCard(a, true))
          )}
        </Box>
      )}
    </Box>
  )
}

export default ModeratorDashboard