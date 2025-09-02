// frontend/src/pages/HomePage.tsx
import React, { useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Box, Container, Typography, Button, Stack, Grid, Card, CardContent, CardMedia,
  Link, Chip, Divider, Tabs, Tab, Paper, Avatar
} from '@mui/material'

// Per-icon imports (MUI v5)
import PetsIcon from '@mui/icons-material/Pets'
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism'
import InfoIcon from '@mui/icons-material/Info'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import FavoriteIcon from '@mui/icons-material/Favorite'
import LocalPhoneIcon from '@mui/icons-material/LocalPhone'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'

import { fetchAnimals, type Animal } from '../services/api'

/**
 * Design notes:
 * - Hero with strong CTA, clean card-like layout, soft shadows, rounded corners.
 * - Quick actions: Adopt / Podpořit / O nás (icon + short text).
 * - Featured animals grid (first 6).
 * - Steps “Jak to funguje” as 4 equal cards.
 * - Compact “O adopci” tabs for info vibe.
 * - Donation stripe with contrasting card.
 * Colors (Dogpoint vibe): deep navy header, primary blue accents, subtle orange highlight (CTA Heart).
 * You can refine colors globally via MUI theme later if you like.
 */

export default function HomePage() {
  const [animals, setAnimals] = useState<Animal[]>([])
  const [tab, setTab] = useState(0)

  useEffect(() => {
    fetchAnimals()
      .then(a => setAnimals(a.slice(0, 6)))
      .catch(() => setAnimals([]))
  }, [])

  return (
    <Box>
      {/* HERO */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #0e1320 0%, #1b2340 60%, #233064 100%)',
          color: '#fff',
          borderBottom: '1px solid rgba(255,255,255,0.08)'
        }}
      >
        <Container maxWidth="lg" sx={{ py: { xs: 6, md: 9 } }}>
          <Grid container spacing={6} alignItems="center">
            <Grid item xs={12} md={7}>
              <Chip
                icon={<ShieldOutlinedIcon sx={{ color: '#a9c0ff' }} />}
                label="Ověřená adopce, bezpečně a s péčí"
                sx={{
                  bgcolor: 'rgba(255,255,255,0.1)',
                  color: '#e6ecff',
                  mb: 2,
                  '& .MuiChip-icon': { color: '#e6ecff' }
                }}
              />
              <Typography component="h1" variant="h3" sx={{ fontWeight: 900, mb: 1 }}>
                Najděte svého parťáka. My zajistíme zbytek.
              </Typography>
              <Typography sx={{ opacity: 0.88, mb: 3, maxWidth: 720 }}>
                V Dogpointu zachraňujeme psy, dáváme jim péči a hledáme jim milující rodiny.
                Přidejte se – adoptujte, dočasně pečujte nebo nás podpořte.
              </Typography>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button
                  component={RouterLink}
                  to="/zvirata"
                  size="large"
                  variant="contained"
                  startIcon={<PetsIcon fontSize="large" />}
                  sx={{
                    bgcolor: '#3b82f6',
                    '&:hover': { bgcolor: '#2563eb' },
                    fontWeight: 700
                  }}
                >
                  Najít psa k adopci
                </Button>
                <Button
                  href="#jak-to-funguje"
                  size="large"
                  variant="outlined"
                  endIcon={<ArrowForwardIcon />}
                  sx={{
                    borderColor: 'rgba(255,255,255,0.4)',
                    color: '#e6ecff',
                    '&:hover': { borderColor: '#fff', background: 'rgba(255,255,255,0.06)' },
                    fontWeight: 700
                  }}
                >
                  Jak to funguje
                </Button>
              </Stack>

              <Stack direction="row" spacing={1.5} sx={{ mt: 3 }} alignItems="center" useFlexGap flexWrap="wrap">
                <Chip
                  icon={<CheckCircleOutlineIcon />}
                  label="Veterinární péče"
                  variant="outlined"
                  sx={{
                    color: '#e6ecff',
                    borderColor: 'rgba(255,255,255,0.4)',
                    '& .MuiChip-icon': { color: '#e6ecff' }
                  }}
                />
                <Chip
                  icon={<CheckCircleOutlineIcon />}
                  label="Zodpovědné umisťování"
                  variant="outlined"
                  sx={{
                    color: '#e6ecff',
                    borderColor: 'rgba(255,255,255,0.4)',
                    '& .MuiChip-icon': { color: '#e6ecff' }
                  }}
                />
                <Chip
                  icon={<CheckCircleOutlineIcon />}
                  label="Podpora po adopci"
                  variant="outlined"
                  sx={{
                    color: '#e6ecff',
                    borderColor: 'rgba(255,255,255,0.4)',
                    '& .MuiChip-icon': { color: '#e6ecff' }
                  }}
                />
              </Stack>
            </Grid>

            <Grid item xs={12} md={5}>
              <Box
                sx={{
                  borderRadius: 4,
                  boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
                  overflow: 'hidden',
                  backgroundColor: '#0e1320',
                  transform: { md: 'translateY(6px)' }
                }}
              >
                <CardMedia
                  component="img"
                  src="/hero-dog.jpg"
                  alt="Dogpoint"
                  sx={{ width: '100%', height: { xs: 260, md: 360 }, objectFit: 'cover' }}
                />
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* QUICK STRIP */}
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
                  <Avatar sx={{ bgcolor: '#e8f0ff', color: '#2563eb' }}>
                    <SearchOutlinedIcon />
                  </Avatar>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>Procházet psy</Typography>
                </Stack>
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                  Vyberte si pejska, který vám padne do oka.
                </Typography>
                <Button component={RouterLink} to="/zvirata" size="small" endIcon={<ArrowForwardIcon />}>
                  Zobrazit nabídku
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
                  <Avatar sx={{ bgcolor: '#fff5ee', color: '#ff6b00' }}>
                    <HomeOutlinedIcon />
                  </Avatar>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>Dočasná péče</Typography>
                </Stack>
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                  Nemůžete adoptovat? Zvažte dočasnou péči.
                </Typography>
                <Button component={RouterLink} to="/zvirata" size="small" endIcon={<ArrowForwardIcon />}>
                  Jak začít
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
                  <Avatar sx={{ bgcolor: '#fff0f3', color: '#e11d48' }}>
                    <VolunteerActivismIcon />
                  </Avatar>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>Podpora</Typography>
                </Stack>
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                  Každý dar pomáhá psům v naší péči.
                </Typography>
                <Button component={RouterLink} to="/podpora" size="small" endIcon={<ArrowForwardIcon />}>
                  Chci přispět
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>

      {/* FEATURED ANIMALS */}
      <Container maxWidth="lg" sx={{ py: 5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>Nově v nabídce</Typography>
          <Button component={RouterLink} to="/zvirata" endIcon={<ArrowForwardIcon />}>Zobrazit všechny</Button>
        </Stack>

        <Grid container spacing={2}>
          {animals.length === 0 && (
            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <PetsIcon />
                  <Typography color="text.secondary">Aktuálně zde nejsou žádní psi.</Typography>
                </Stack>
              </Paper>
            </Grid>
          )}

          {animals.map(a => (
            <Grid item xs={12} sm={6} md={4} key={a.id}>
              <Card
                variant="outlined"
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 3,
                  transition: 'transform .12s ease, box-shadow .12s ease',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 14px 30px rgba(0,0,0,0.08)'
                  }
                }}
              >
                <CardMedia
                  component="img"
                  height="220"
                  image={a.galerie?.[0]?.url || '/no-image.jpg'}
                  alt={a.jmeno || a.name || 'Pes'}
                  sx={{ objectFit: 'cover' }}
                />
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    {a.jmeno || a.name || 'Pes'}
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 0.5 }} noWrap>
                    {a.popis || a.description || 'Bez popisu'}
                  </Typography>
                </CardContent>
                <Box sx={{ px: 2, pb: 2 }}>
                  <Button
                    component={RouterLink}
                    to="/zvirata"
                    size="small"
                    variant="contained"
                    fullWidth
                    sx={{ bgcolor: '#3b82f6', '&:hover': { bgcolor: '#2563eb' } }}
                  >
                    Detail & adopce
                  </Button>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* HOW IT WORKS */}
      <Box id="jak-to-funguje" sx={{ background: '#f8faff', borderTop: '1px solid #eef2ff', borderBottom: '1px solid #eef2ff', py: 6, mt: 1 }}>
        <Container maxWidth="lg">
          <Typography variant="h5" sx={{ fontWeight: 900, mb: 3, textAlign: 'center' }}>
            Jak probíhá adopce
          </Typography>
          <Grid container spacing={2}>
            {[
              { n: 1, t: 'Vyberete si psa', d: 'Najdete parťáka, který vám sedne.' },
              { n: 2, t: 'Kontaktujeme vás', d: 'Domluvíme se na setkání.' },
              { n: 3, t: 'Seznámení a péče', d: 'Vysvětlíme potřeby a zázemí.' },
              { n: 4, t: 'Domov', d: 'Podepíšeme smlouvu a pes jde domů.' },
            ].map(s => (
              <Grid item xs={12} md={3} key={s.n}>
                <Card variant="outlined" sx={{ borderRadius: 3, height: '100%' }}>
                  <CardContent>
                    <Chip label={s.n} color="primary" sx={{ mb: 1, bgcolor: '#3b82f6' }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{s.t}</Typography>
                    <Typography color="text.secondary">{s.d}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* INFO TABS */}
      <Container maxWidth="lg" sx={{ py: 5 }}>
        <Paper variant="outlined" sx={{ borderRadius: 3 }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            aria-label="info tabs"
            sx={{
              borderBottom: '1px solid #eef2ff',
              '& .MuiTab-root': { fontWeight: 700, textTransform: 'none' }
            }}
          >
            <Tab label="O adopci" icon={<InfoIcon />} iconPosition="start" />
            <Tab label="Co přinést" icon={<CheckCircleOutlineIcon />} iconPosition="start" />
            <Tab label="Kontakt" icon={<LocalPhoneIcon />} iconPosition="start" />
          </Tabs>
          <Box sx={{ p: 3 }}>
            {tab === 0 && (
              <Typography color="text.secondary">
                Adopce je závazek na mnoho let. Pomůžeme vám vybrat pejska, který zapadne do vaší rodiny
                i životního stylu. Vysvětlíme péči, výživu i výcvikové tipy.
              </Typography>
            )}
            {tab === 1 && (
              <Typography color="text.secondary">
                Na seznámení si vezměte občanský průkaz, vodítko, obojek a klidně i pamlsky. Vše ostatní
                probereme na místě.
              </Typography>
            )}
            {tab === 2 && (
              <Stack spacing={1}>
                <Typography><strong>Telefon:</strong> <Link href="tel:+420000000000">+420 000 000 000</Link></Typography>
                <Typography><strong>E-mail:</strong> <Link href="mailto:info@dogpoint.cz">info@dogpoint.cz</Link></Typography>
              </Stack>
            )}
          </Box>
        </Paper>
      </Container>

      {/* DONATION STRIPE */}
      <Box sx={{ background: '#0e1320', color: '#fff', py: 6 }}>
        <Container maxWidth="lg">
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={7}>
              <Typography variant="h5" sx={{ fontWeight: 900, mb: 1 }}>
                Podpořte naši činnost
              </Typography>
              <Typography sx={{ opacity: 0.9, mb: 2 }}>
                Každá koruna zlepšuje život psům v naší péči. Děkujeme. ❤️
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button startIcon={<FavoriteIcon />} variant="contained"
                        sx={{ bgcolor: '#ff6b00', '&:hover': { bgcolor: '#ea580c' }, fontWeight: 700 }}>
                  Jednorázový dar
                </Button>
                <Button variant="outlined"
                        sx={{ borderColor: 'rgba(255,255,255,0.5)', color: '#fff', '&:hover': { borderColor: '#fff' }, fontWeight: 700 }}>
                  Pravidelná podpora
                </Button>
              </Stack>
            </Grid>
            <Grid item xs={12} md={5}>
              <Card variant="outlined" sx={{ borderRadius: 3, background: '#151a2b', borderColor: 'rgba(255,255,255,0.12)' }}>
                <CardContent>
                  <Typography sx={{ fontWeight: 800, mb: 1, color: '#e6ecff' }}>Transparentní účet</Typography>
                  <Typography sx={{ color: '#c8d4ff' }}>Číslo účtu: 123456789/0100</Typography>
                  <Divider sx={{ my: 1.5, borderColor: 'rgba(255,255,255,0.12)' }} />
                  <Typography sx={{ fontWeight: 800, mb: 1, color: '#e6ecff' }}>Kontakt</Typography>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <LocalPhoneIcon fontSize="small" />
                    <Link href="tel:+420000000000" sx={{ color: '#c8d4ff' }}>+420 000 000 000</Link>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* FOOTER */}
      <Box sx={{ background: '#0e1320', color: '#fff', py: 5 }}>
        <Container maxWidth="lg">
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" sx={{ fontWeight: 900, mb: 1 }}>Dogpoint</Typography>
              <Typography sx={{ opacity: 0.85 }}>Pomáháme psům najít milující domov.</Typography>
            </Grid>
            <Grid item xs={12} md={6} textAlign={{ xs: 'left', md: 'right' }}>
              <Stack direction="row" spacing={3} sx={{ justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
                <Link component={RouterLink} to="/zvirata" sx={{ color: '#fff' }}>Psy k adopci</Link>
                <Link component={RouterLink} to="/moderator/login" sx={{ color: '#fff' }}>Moderátor</Link>
                <Link component={RouterLink} to="/o-nas" sx={{ color: '#fff' }}>O nás</Link>
              </Stack>
              <Typography sx={{ mt: 1, opacity: 0.6 }}>© {new Date().getFullYear()} Dogpoint</Typography>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </Box>
  )
}