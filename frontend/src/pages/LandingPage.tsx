// frontend/src/pages/LandingPage.tsx
import React from 'react'
import {
  Box, Container, Grid, Typography, Button, Paper
} from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

export default function LandingPage() {
  return (
    <Box>
      {/* HERO – tuned to sit under the wave nicely */}
      <Box
        sx={{
          background: 'linear-gradient(180deg, #F2FEFE 0%, #ECFBFB 100%)',
          // pull the hero gently under the wave for a seamless feel
          pt: { xs: 3, md: 5 },
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
                <Button
                  component={RouterLink}
                  to="/login"
                  variant="contained"
                >
                  Přihlásit se
                </Button>
                <Button
                  component={RouterLink}
                  to="/zvirata"
                  variant="outlined"
                >
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
                  src="https://images.unsplash.com/photo-1601758124093-27e9c3d37a6a?q=80&w=1600&auto=format&fit=crop"
                  alt="Pes čekající na nový domov"
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

      {/* space for the rest of your landing sections … */}
    </Box>
  )
}