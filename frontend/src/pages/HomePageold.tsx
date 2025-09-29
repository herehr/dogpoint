// frontend/src/pages/HomePage.tsx
import React, { useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Box, Container, Typography, Button, Stack, Grid, Card, CardContent, CardMedia, Link, Chip, Divider
} from '@mui/material'
import PetsIcon from '@mui/icons-material/Pets'
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism'
import InfoIcon from '@mui/icons-material/Info'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import FavoriteIcon from '@mui/icons-material/Favorite'
import LocalPhoneIcon from '@mui/icons-material/LocalPhone'
import { fetchAnimals, type Animal } from '../api'

export default function HomePage() {
  const [animals, setAnimals] = useState<Animal[]>([])
  useEffect(() => { fetchAnimals().then(a => setAnimals(a.slice(0, 6))).catch(() => setAnimals([])) }, [])

  return (
    <Box>
      {/* HERO */}
      <Box sx={{ background: 'linear-gradient(135deg, #f6f8ff 0%, #fff 60%)', borderBottom: '1px solid #eef0f7' }}>
        <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
          <Grid container spacing={6} alignItems="center">
            <Grid item xs={12} md={7}>
              <Typography component="h1" variant="h3" sx={{ fontWeight: 800, mb: 2 }}>
                Dejte psům nový domov. <br />Oni vám dají srdce. ❤️
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 680 }}>
                V Dogpointu zachraňujeme psy, dáváme jim péči a hledáme jim milující rodiny.
                Přidejte se – adoptujte, dočasně pečujte nebo nás podpořte.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button
                  component={RouterLink}
                  to="/zvirata"
                  size="large"
                  variant="contained"
                  startIcon={<PetsIcon fontSize="large" />}  // ✅ fixed import + explicit size
                >
                  Najít psa k adopci
                </Button>
                <Button href="#jak-to-funguje" size="large" variant="outlined" endIcon={<ArrowForwardIcon />}>
                  Jak to funguje
                </Button>
              </Stack>
              <Stack direction="row" spacing={1.5} sx={{ mt: 3 }} alignItems="center">
                <Chip icon={<CheckCircleOutlineIcon />} label="Veterinární péče" color="success" variant="outlined" />
                <Chip icon={<CheckCircleOutlineIcon />} label="Zodpovědné umisťování" color="success" variant="outlined" />
                <Chip icon={<CheckCircleOutlineIcon />} label="Podpora po adopci" color="success" variant="outlined" />
              </Stack>
            </Grid>
            <Grid item xs={12} md={5}>
              <Box sx={{ borderRadius: 4, boxShadow: '0 8px 30px rgba(0,0,0,0.08)', overflow: 'hidden', backgroundColor: '#fff' }}>
                <CardMedia component="img" src="/hero-dog.jpg" alt="Dogpoint" sx={{ width: '100%', height: { xs: 260, md: 340 }, objectFit: 'cover' }} />
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* QUICK CTA STRIP */}
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Card variant="outlined"><CardContent>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
                <PetsIcon />  {/* small icon is fine here */}
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Adopce</Typography>
              </Stack>
              <Typography color="text.secondary" sx={{ mb: 2 }}>Vyberte si psa, který vám padne do oka.</Typography>
              <Button component={RouterLink} to="/zvirata" size="small" endIcon={<ArrowForwardIcon />}>Prohlédnout psy</Button>
            </CardContent></Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card variant="outlined"><CardContent>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
                <VolunteerActivismIcon /><Typography variant="h6" sx={{ fontWeight: 700 }}>Podpora</Typography>
              </Stack>
              <Typography color="text.secondary" sx={{ mb: 2 }}>I malý dar pomáhá. Děkujeme!</Typography>
              <Button component={RouterLink} to="/podpora" size="small" endIcon={<ArrowForwardIcon />}>Chci přispět</Button>
            </CardContent></Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card variant="outlined"><CardContent>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
                <InfoIcon /><Typography variant="h6" sx={{ fontWeight: 700 }}>O nás</Typography>
              </Stack>
              <Typography color="text.secondary" sx={{ mb: 2 }}>Jsme nezisková organizace.</Typography>
              <Button component={RouterLink} to="/o-nas" size="small" endIcon={<ArrowForwardIcon />}>Více o Dogpointu</Button>
            </CardContent></Card>
          </Grid>
        </Grid>
      </Container>

      {/* LATEST DOGS */}
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>Nově v nabídce</Typography>
          <Button component={RouterLink} to="/zvirata" endIcon={<ArrowForwardIcon />}>Zobrazit všechny</Button>
        </Stack>
        <Grid container spacing={2}>
          {animals.length === 0 && (
            <Grid item xs={12}><Typography color="text.secondary">Aktuálně zde nejsou žádní psi.</Typography></Grid>
          )}
          {animals.map(a => (
            <Grid item xs={12} sm={6} md={4} key={a.id}>
              <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardMedia component="img" height="220" image={a.galerie?.[0]?.url || '/no-image.jpg'} alt={a.jmeno || a.name || 'Pes'} sx={{ objectFit: 'cover' }} />
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>{a.jmeno || a.name || 'Pes'}</Typography>
                  <Typography color="text.secondary" sx={{ mt: 0.5 }} noWrap>{a.popis || a.description || 'Bez popisu'}</Typography>
                </CardContent>
                <Box sx={{ px: 2, pb: 2 }}>
                  <Button component={RouterLink} to="/zvirata" size="small" variant="contained" fullWidth>Detail & adopce</Button>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* HOW IT WORKS */}
      <Box id="jak-to-funguje" sx={{ background: '#fafbff', borderTop: '1px solid #eef0f7', borderBottom: '1px solid #eef0f7', py: 6, mt: 4 }}>
        <Container maxWidth="lg">
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 3 }}>Jak probíhá adopce</Typography>
          <Grid container spacing={2}>
            {[
              { n: 1, t: 'Vyberete si psa', d: 'Najdete parťáka, který vám sedne.' },
              { n: 2, t: 'Kontaktujeme vás', d: 'Domluvíme se na setkání.' },
              { n: 3, t: 'Seznámení a péče', d: 'Vysvětlíme potřeby a zázemí.' },
              { n: 4, t: 'Domov', d: 'Podepíšeme smlouvu a pes jde domů.' },
            ].map(s => (
              <Grid item xs={12} md={3} key={s.n}>
                <Card variant="outlined"><CardContent>
                  <Chip label={s.n} color="primary" sx={{ mb: 1 }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{s.t}</Typography>
                  <Typography color="text.secondary">{s.d}</Typography>
                </CardContent></Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* DONATE */}
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Grid container spacing={4} alignItems="center">
          <Grid item xs={12} md={7}>
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>Podpořte naši činnost</Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>Každá koruna zlepšuje život psům v naší péči. Děkujeme. ❤️</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Button startIcon={<FavoriteIcon />} variant="contained">Jednorázový dar</Button>
              <Button variant="outlined">Pravidelná podpora</Button>
            </Stack>
          </Grid>
          <Grid item xs={12} md={5}>
            <Card variant="outlined"><CardContent>
              <Typography sx={{ fontWeight: 700, mb: 1 }}>Transparentní účet</Typography>
              <Typography color="text.secondary">Číslo účtu: 123456789/0100</Typography>
              <Divider sx={{ my: 1.5 }} />
              <Typography sx={{ fontWeight: 700, mb: 1 }}>Kontakt</Typography>
              <Stack direction="row" alignItems="center" spacing={1}><LocalPhoneIcon fontSize="small" /><Link href="tel:+420000000000">+420 000 000 000</Link></Stack>
            </CardContent></Card>
          </Grid>
        </Grid>
      </Container>

      {/* FOOTER */}
      <Box sx={{ background: '#0e1320', color: '#fff', py: 5, mt: 6 }}>
        <Container maxWidth="lg">
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Dogpoint</Typography>
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