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
  Grid,
  Divider,
} from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext' // shared auth

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

type PostStatus = 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED'

interface PostMedia {
  id: string
  url: string
  typ: string
}

interface Post {
  id: string
  title: string
  body?: string | null
  active: boolean
  status: PostStatus
  animalId: string
  createdAt?: string
  animal?: {
    id: string
    jmeno?: string | null
    name?: string | null
  } | null
  media?: PostMedia[]
}

type TabKey = 'published' | 'pending'

const ModeratorAnimals: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { token } = useAuth()

  // initial tab from URL
  const paramsAtMount = new URLSearchParams(location.search)
  const tabParam = paramsAtMount.get('tab')
  const [tab, setTab] = useState<TabKey>(
    tabParam === 'pending' ? 'pending' : 'published',
  )

  const [published, setPublished] = useState<Animal[]>([])
  const [pending, setPending] = useState<Animal[]>([])
  const [pendingPosts, setPendingPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const authHeaders: HeadersInit = token
    ? { Authorization: `Bearer ${token}` }
    : {}

  // keep tab in sync with ?tab=...
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const t = params.get('tab')
    setTab(t === 'pending' ? 'pending' : 'published')
  }, [location.search])

  /* ---------- FETCHERS ---------- */

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

  const fetchPendingAnimals = async () => {
    if (!token) {
      setPending([])
      return
    }
    try {
      setError(null)
      const res = await fetch(`${API_BASE_URL}/api/animals/pending`, {
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
      })
      if (res.status === 401 || res.status === 403) {
        setPending([])
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: Animal[] = await res.json()
      setPending(data)
    } catch (e: any) {
      console.error('fetchPendingAnimals error', e)
      setError('Nepodařilo se načíst neschválená zvířata.')
    }
  }

  const fetchPendingPosts = async () => {
    if (!token) {
      setPendingPosts([])
      return
    }
    try {
      setError(null)
      const res = await fetch(`${API_BASE_URL}/api/posts/pending`, {
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
      })
      if (res.status === 401 || res.status === 403) {
        setPendingPosts([])
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: Post[] = await res.json()
      setPendingPosts(data)
    } catch (e: any) {
      console.error('fetchPendingPosts error', e)
      setError('Nepodařilo se načíst neschválené příspěvky.')
    }
  }

  const refreshAll = async () => {
    setLoading(true)
    await Promise.all([fetchPublished(), fetchPendingAnimals(), fetchPendingPosts()])
    setLoading(false)
  }

  useEffect(() => {
    refreshAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  /* ---------- HANDLERS ---------- */

  const handleTabChange = (_e: React.SyntheticEvent, newValue: TabKey) => {
    const search = newValue === 'pending' ? '?tab=pending' : ''
    navigate(`/moderator/animals${search}`)
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
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await refreshAll()
    } catch (e: any) {
      console.error('approve animal error', e)
      setError('Nepodařilo se schválit zvíře.')
    } finally {
      setLoading(false)
    }
  }

  const handleApprovePost = async (id: string) => {
    if (!token) {
      alert('Nejste přihlášen jako moderátor / admin.')
      return
    }

    try {
      setLoading(true)
      setError(null)
      const res = await fetch(
        `${API_BASE_URL}/api/posts/${id}/approve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders,
          },
        },
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await fetchPendingPosts()
    } catch (e: any) {
      console.error('approve post error', e)
      setError('Nepodařilo se schválit příspěvek.')
    } finally {
      setLoading(false)
    }
  }

  /* ---------- RENDER HELPERS ---------- */

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
      <Card key={animal.id} sx={{ mb: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {img && (
          <Box
            component="img"
            src={img}
            alt={name}
            sx={{ width: '100%', maxHeight: 220, objectFit: 'cover' }}
          />
        )}
        <CardContent sx={{ flexGrow: 1 }}>
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
        {isPending && (
          <CardActions sx={{ justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              size="small"
              onClick={() => handleApproveAnimal(animal.id)}
            >
              Schválit zvíře
            </Button>
          </CardActions>
        )}
      </Card>
    )
  }

  const renderPostCard = (post: Post) => {
    const animalName = post.animal?.jmeno || post.animal?.name || 'Bez zvířete'
    const created = post.createdAt
      ? new Date(post.createdAt).toLocaleString('cs-CZ')
      : ''

    const firstMedia = post.media?.[0]?.url

    return (
      <Card key={post.id} sx={{ mb: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {firstMedia && (
          <Box
            component="img"
            src={firstMedia}
            alt={post.title}
            sx={{ width: '100%', maxHeight: 220, objectFit: 'cover' }}
          />
        )}
        <CardContent sx={{ flexGrow: 1 }}>
          <Stack spacing={0.5}>
            <Typography variant="subtitle2" color="text.secondary">
              {animalName}
            </Typography>
            <Typography variant="h6">{post.title}</Typography>
            {post.body && (
              <Typography variant="body2" color="text.secondary">
                {post.body.replace(/<[^>]+>/g, '').slice(0, 160)}…
              </Typography>
            )}
            {created && (
              <Typography variant="caption" color="text.secondary">
                Vytvořeno: {created}
              </Typography>
            )}
          </Stack>
        </CardContent>
        <CardActions sx={{ justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            size="small"
            onClick={() => handleApprovePost(post.id)}
          >
            Schválit příspěvek
          </Button>
        </CardActions>
      </Card>
    )
  }

  const list = tab === 'published' ? published : pending
  const isPendingTab = tab === 'pending'

  /* ---------- RENDER ---------- */

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        sx={{ mb: 2 }}
        spacing={1}
      >
        <Typography variant="h5" sx={{ fontWeight: 900 }}>
          Správa zvířat
        </Typography>

        {/* Button to full manager (add/edit) */}
        <Button
          variant="contained"
          onClick={() => navigate('/moderator/zvirata-sprava')}
        >
          Přidat / upravit zvíře
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

      {/* --- ZVÍŘATA --- */}
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
        {isPendingTab ? 'Zvířata ke schválení' : 'Schválená zvířata'}
      </Typography>

      {list.length === 0 ? (
        <Typography variant="body2" sx={{ mb: 3 }}>
          {isPendingTab
            ? 'Žádná zvířata nečekají na schválení.'
            : 'Žádná schválená zvířata.'}
        </Typography>
      ) : (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {list.map((a) => (
            <Grid key={a.id} item xs={12} sm={6} md={4}>
              {renderAnimalCard(a, isPendingTab)}
            </Grid>
          ))}
        </Grid>
      )}

      {/* --- PŘÍSPĚVKY KE SCHVÁLENÍ (jen na pending tab) --- */}
      {isPendingTab && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
            Příspěvky ke schválení
          </Typography>

          {pendingPosts.length === 0 ? (
            <Typography variant="body2">
              Žádné příspěvky nečekají na schválení.
            </Typography>
          ) : (
            <Grid container spacing={2}>
              {pendingPosts.map((p) => (
                <Grid key={p.id} item xs={12} sm={6} md={4}>
                  {renderPostCard(p)}
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}
    </Container>
  )
}

export default ModeratorAnimals