// frontend/src/pages/ModeratorAnimals.tsx
import React, { useEffect, useState } from 'react'
import {
  Container,
  Typography,
  Tabs,
  Tab,
  Box,
  Card,
  CardContent,
  CardActions,
  Button,
  Stack,
  Chip,
} from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'

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

const ModeratorAnimals: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()

  // initial tab
  const paramsAtMount = new URLSearchParams(location.search)
  const tabParam = paramsAtMount.get('tab')
  const [tab, setTab] = useState<TabKey>(
    tabParam === 'pending' ? 'pending' : 'published',
  )

  const [published, setPublished] = useState<Animal[]>([])
  const [pending, setPending] = useState<Animal[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const token =
    typeof window !== 'undefined'
      ? sessionStorage.getItem('moderatorToken')
      : null

  const authHeaders: HeadersInit = token
    ? { Authorization: `Bearer ${token}` }
    : {}

  // sync with ?tab=pending
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const t = params.get('tab')
    setTab(t === 'pending' ? 'pending' : 'published')
  }, [location.search])

  const fetchPublished = async () => {
    try {
      setError(null)
      const res = await fetch(`${API_BASE_URL}/api/animals?active=true`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: Animal[] = await res.json()
      setPublished(data)
    } catch (e: any) {
      console.error('fetchPublished error', e)
      setError('Nepodařilo se načíst schválená zvířata.')
    }
  }

  const fetchPending = async () => {
    try {
      setError(null)
      const res = await fetch(`${API_BASE_URL}/api/animals/pending`, {
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
      })
      if (res.status === 401 || res.status === 403) {
        setError('Nemáte oprávnění zobrazit neschválená zvířata.')
        setPending([])
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: Animal[] = await res.json()
      setPending(data)
    } catch (e: any) {
      console.error('fetchPending error', e)
      setError('Nepodařilo se načíst neschválená zvířata.')
    }
  }

  const refreshAll = async () => {
    setLoading(true)
    await Promise.all([fetchPublished(), fetchPending()])
    setLoading(false)
  }

  useEffect(() => {
    refreshAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleTabChange = (_e: React.SyntheticEvent, newValue: TabKey) => {
    const search = newValue === 'pending' ? '?tab=pending' : ''
    navigate(`/moderator/animals${search}`)
    setTab(newValue)
  }

  const handleApprove = async (id: string) => {
    if (!token) {
      alert('Nejste přihlášen jako moderátor / admin.')
      return
    }

    try {
      setLoading(true)
      setError(null)
      const res = await fetch(
        `${API_BASE_URL}/api/moderation/animals/${id}/approve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders,
          },
        },
      )
      if (res.status === 401 || res.status === 403) {
        setError('Nemáte oprávnění schválit toto zvíře.')
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await refreshAll()
    } catch (e: any) {
      console.error('approve error', e)
      setError('Nepodařilo se schválit zvíře.')
    } finally {
      setLoading(false)
    }
  }

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
            sx={{ width: '100%', maxHeight: 220, objectFit: 'cover' }}
          />
        )}
        <CardContent>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            mb={1}
          >
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
              onClick={() => handleApprove(animal.id)}
            >
              Schválit
            </Button>
          )}
        </CardActions>
      </Card>
    )
  }

  const list = tab === 'published' ? published : pending
  const isPendingTab = tab === 'pending'

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 2 }}
      >
        <Typography variant="h5" sx={{ fontWeight: 900 }}>
          Správa zvířat
        </Typography>

        {/* ADD ANIMAL BUTTON — restored */}
        <Button
          variant="contained"
          onClick={() => navigate('/moderator/pridat')}
        >
          Přidat zvíře
        </Button>
      </Stack>

      <Tabs
        value={tab}
        onChange={handleTabChange}
        textColor="primary"
        indicatorColor="primary"
        sx={{ mb: 2 }}
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

      {list.length === 0 ? (
        <Typography variant="body2">
          {isPendingTab
            ? 'Žádná zvířata nečekají na schválení.'
            : 'Žádná schválená zvířata.'}
        </Typography>
      ) : (
        // 🔥 DESKTOP GRID — MOBILE FIRST
        <Box
          display="grid"
          gridTemplateColumns={{
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
          }}
          gap={2}
          sx={{ mt: 2 }}
        >
          {list.map((a) => (
            <Box key={a.id}>{renderAnimalCard(a, isPendingTab)}</Box>
          ))}
        </Box>
      )}
    </Container>
  )
}

export default ModeratorAnimals