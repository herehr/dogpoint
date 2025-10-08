import React from 'react'
import { Box, Container, Grid, Typography, Button, Paper } from '@mui/material'

export default function Hero() {
  // Smooth scroll to AnimalTeasers section
  const scrollToAnimals = () => {
    const el = document.getElementById('animals-section')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <Box
      sx={{
        background: '#ECFBFB',      // solid light color under the wave
        mt: { xs: -2, md: -3 },
        pt: { xs: 3.5, md: 5.5 },
        pb: { xs: 5, md: 8 },
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={6}>
            <Typography
              component="h1"
              sx={{
                fontSize: { xs: 32, sm: 40, md: 48 },
                fontWeight: 900,
                lineHeight: 1.1,
                color: '#0E1C2B',
                mb: 1.5,
              }}
            >
              Změňte život
              <br />
              mazlíčků.
            </Typography>

            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Dálková adopce, blízké pouto.
            </Typography>

            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <Button href="/login" variant="contained">
                Přihlásit se
              </Button>
              <Button onClick={scrollToAnimals} variant="outlined">
                Vybrat zvíře
              </Button>
            </Box>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper
              elevation={6}
              sx={{
                borderRadius: 6,
                p: { xs: 1.5, sm: 2.5 },
                mx: { xs: 'auto', md: 0 },
                maxWidth: 520,
              }}
            >
              <img
                src="hero.jpg"
                alt="Pes čekající na nový domov"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/hero-dog.jpg'
                }}
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                  borderRadius: 16,
                }}
              />
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  )
}