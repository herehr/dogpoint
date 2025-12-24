// frontend/src/prototypes/UXPrototype.tsx
import React from 'react'
import { Routes, Route, Link, useParams, useNavigate } from 'react-router-dom'
import {
  AppBar,
  Toolbar,
  Container,
  Grid,
  Card,
  CardMedia,
  CardContent,
  Typography,
  Chip,
  Button,
  Stack,
  Box,
  TextField,
  Paper,
  Divider,
  Snackbar,
  Alert,
} from '@mui/material'

// --- demo data ---
type Kind = 'pes' | 'kočka' | 'jiné'
type Media = {
  url: string
  type?: 'image' | 'video'
  typ?: 'image' | 'video'
  poster?: string
  posterUrl?: string
}
type Animal = {
  id: string
  jmeno: string
  druh: Kind
  vek: string
  popis: string
  main: string
  galerie: Media[]
  active: boolean
}

const DEMO: Animal[] = [
  {
    id: 'a1',
    jmeno: 'Bady',
    druh: 'pes',
    vek: '3 roky',
    popis:
      'Milý, hravý parťák, který miluje procházky a kratší běhy. Vhodný do aktivní rodiny s dětmi.',
    main: '/hero-dog.jpg',
    galerie: [{ url: '/hero-dog.jpg' }, { url: '/no-image.jpg' }],
    active: true,
  },
  {
    id: 'a2',
    jmeno: 'Mona',
    druh: 'pes',
    vek: '6 měsíců',
    popis:
      'Energická fenečka s jemnou povahou. Učí se rychle a má ráda pamlsky. Hledá trpělivé páníčky.',
    main: '/no-image.jpg',
    galerie: [{ url: '/no-image.jpg' }],
    active: true,
  },
]

// --- local "adoption unlock" store (simulated) ---
const storeKey = (id: string) => `adopted:${id}`
const isUnlocked = (id: string) =>
  typeof window !== 'undefined' && !!localStorage.getItem(storeKey(id))
const setUnlocked = (id: string) => localStorage.setItem(storeKey(id), '1')

// --- shared UI helpers ---
const clamp3 = {
  display: '-webkit-box',
  WebkitLineClamp: 3 as any,
  WebkitBoxOrient: 'vertical' as any,
  overflow: 'hidden',
} // MDN line-clamp usage w/ -webkit fallback. See docs.

function BadgeRow({ kind, age }: { kind: Kind; age: string }) {
  return (
    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
      <Chip size="small" label={kind === 'pes' ? 'Pes' : kind} />
      <Chip size="small" label={age} />
    </Stack>
  )
}

function isVideoMedia(m: Media): boolean {
  const t = String(m.typ || m.type || '').toLowerCase()
  if (t.includes('video')) return true
  return /\.(mp4|webm|m4v|mov)(\?|$)/i.test(m.url || '')
}

function guessVideoMime(url: string): string {
  const u = (url || '').toLowerCase()
  if (u.includes('.webm')) return 'video/webm'
  return 'video/mp4'
}

// --- listing ---
function ListView() {
  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 900, mb: 2 }}>
        Psi k adopci
      </Typography>
      <Grid container spacing={2}>
        {DEMO.filter((a) => a.active).map((a) => (
          <Grid key={a.id} item xs={12} sm={6} md={4}>
            <Card
              variant="outlined"
              component={Link as any}
              to={`/proto/zvire/${a.id}`}
              sx={{ textDecoration: 'none' }}
            >
              <CardMedia
                component="img"
                image={a.main}
                alt={a.jmeno}
                height="220"
                sx={{ objectFit: 'cover' }}
              />
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {a.jmeno}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={clamp3}>
                  {a.popis}
                </Typography>
                <BadgeRow kind={a.druh} age={a.vek} />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  )
}

// --- detail ---
function DetailView() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const a = DEMO.find((x) => x.id === id)
  const unlocked = a ? isUnlocked(a.id) : false

  const [toast, setToast] = React.useState<string>('')

  if (!a) {
    return (
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <Typography variant="h6">Zvíře nenalezeno</Typography>
        <Button sx={{ mt: 2 }} onClick={() => nav('/proto')} variant="contained">
          Zpět
        </Button>
      </Container>
    )
  }

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Stack spacing={2}>
        <img
          src={a.main}
          alt={a.jmeno}
          style={{ width: '100%', borderRadius: 12, objectFit: 'cover' }}
        />
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h4" sx={{ fontWeight: 900 }}>
            {a.jmeno}
          </Typography>
          <BadgeRow kind={a.druh} age={a.vek} />
        </Stack>

        <Typography color="text.secondary">{a.popis}</Typography>

        {/* Blurred gallery until adoption */}
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
            Galerie
          </Typography>
          <Grid container spacing={1}>
            {a.galerie.map((m, i) => {
              const isVideo = isVideoMedia(m)
              const poster = m.posterUrl || m.poster || undefined

              return (
                <Grid key={i} item xs={6} sm={4}>
                  <Box
                    sx={{
                      position: 'relative',
                      borderRadius: 2,
                      overflow: 'hidden',
                      ...(unlocked ? {} : { filter: 'blur(8px)', pointerEvents: 'none' }),
                    }}
                  >
                    {isVideo ? (
                      <video
                        controls
                        preload="metadata"
                        playsInline
                        poster={poster}
                        style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }}
                      >
                        <source src={m.url} type={guessVideoMime(m.url)} />
                      </video>
                    ) : (
                      <img
                        src={m.url}
                        alt={`${a.jmeno} ${i + 1}`}
                        style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }}
                      />
                    )}

                    {!unlocked && (
                      <Box
                        sx={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: 'rgba(0,0,0,0.25)',
                          color: '#fff',
                          fontWeight: 700,
                        }}
                      >
                        Zamčeno — odemkne se po adopci
                      </Box>
                    )}
                  </Box>
                </Grid>
              )
            })}
          </Grid>
        </Box>

        {!unlocked ? (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Button
              variant="contained"
              size="large"
              onClick={() => {
                setUnlocked(a.id)
                setToast('Adopce úspěšná (simulace). Galerie odemčena.')
              }}
            >
              Chci adoptovat
            </Button>
            <Button variant="outlined" onClick={() => nav('/proto')}>
              Zpět na seznam
            </Button>
          </Stack>
        ) : (
          <>
            <Divider />
            <Typography variant="h6" sx={{ fontWeight: 900 }}>
              Sdílejte svůj příběh
            </Typography>
            <PostForm onPosted={() => setToast('Děkujeme! Příspěvek uložen (lokálně v prototypu).')} />
          </>
        )}
      </Stack>

      <Snackbar open={!!toast} autoHideDuration={2500} onClose={() => setToast('')}>
        <Alert severity="success" variant="filled" onClose={() => setToast('')}>
          {toast}
        </Alert>
      </Snackbar>
    </Container>
  )
}

// --- simple posting form (prototype-local only) ---
function PostForm({ onPosted }: { onPosted: () => void }) {
  const [title, setTitle] = React.useState('')
  const [text, setText] = React.useState('')
  const canPost = title.trim().length > 0 || text.trim().length > 0

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
      <Stack spacing={2}>
        <TextField label="Titulek" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth />
        <TextField
          label="Text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          fullWidth
          multiline
          minRows={3}
        />
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            disabled={!canPost}
            onClick={() => {
              setTitle('')
              setText('')
              onPosted()
            }}
          >
            Odeslat
          </Button>
        </Stack>
      </Stack>
    </Paper>
  )
}

export default function UXPrototype() {
  return (
    <>
      <AppBar position="sticky" color="default" elevation={0}>
        <Toolbar>
          <Container maxWidth="lg" sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Dogpoint · Prototyp
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button component={Link as any} to="/proto" color="primary">
                Seznam
              </Button>
            </Stack>
          </Container>
        </Toolbar>
      </AppBar>

      {/* nested routes under /proto */}
      <Routes>
        <Route path="/" element={<ListView />} />
        <Route path="/zvire/:id" element={<DetailView />} />
      </Routes>
    </>
  )
}