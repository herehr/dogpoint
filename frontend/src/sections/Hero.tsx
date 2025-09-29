// frontend/src/sections/Hero.tsx
import React from 'react';
import { Box, Button, Container, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

export default function Hero() {
  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        bgcolor: '#EFFFFF',
        pb: { xs: 6, md: 10 },
      }}
    >
      {/* curved aqua bar */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: { xs: 120, md: 160 },
          background: 'linear-gradient(90deg, #00A0A6, #00B3B8)',
          clipPath: 'ellipse(120% 80% at 50% 0%)',
        }}
      />
      <Container sx={{ pt: { xs: 12, md: 16 } }}>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={4} alignItems="center">
          <Stack flex={1} gap={2}>
            <Typography variant="h3" sx={{ fontWeight: 900, letterSpacing: '-0.02em' }}>
              Změňte život mazlíčků.
            </Typography>
            <Typography variant="h6" sx={{ color: 'text.secondary' }}>
              Dálková adopce, blízké pouto.
            </Typography>
            <Stack direction="row" gap={2} mt={1}>
              <Button component={RouterLink} to="/prihlaseni" variant="contained">
                Přihlásit se
              </Button>
              <Button component={RouterLink} to="/zvirata" variant="outlined">
                Vybrat zvíře
              </Button>
            </Stack>
          </Stack>
          <Box
            flex={1}
            sx={{
              width: '100%',
              borderRadius: 4,
              overflow: 'hidden',
              boxShadow: 3,
              minHeight: { xs: 220, md: 360 },
              backgroundImage: `url(/hero-dog.jpg)`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
            aria-label="Pes a kočka – hero"
          />
        </Stack>
      </Container>
    </Box>
  );
}