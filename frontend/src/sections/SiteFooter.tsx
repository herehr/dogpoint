// frontend/src/sections/SiteFooter.tsx
import React from 'react';
import { Box, Container, Link, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

export default function SiteFooter() {
  return (
    <Box sx={{ bgcolor: 'brand.dark', color: 'white', py: 4 }}>
      <Container>
        <Stack gap={1}>
          <Typography variant="h6" sx={{ fontWeight: 900 }}>
            DOGPOINT
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            Kontakt
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            © {new Date().getFullYear()} Dogpoint o. p. s. •{' '}
            <Link
            component={RouterLink}
            to="/ochrana-osobnich-udaju"
           color="inherit"
  sx={{ textDecoration: 'underline' }}
>
  Ochrana osobních údajů
</Link>
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}