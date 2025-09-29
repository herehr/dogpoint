// frontend/src/sections/AboutUs.tsx
import React from 'react';
import { Box, Container, Paper, Stack, Typography } from '@mui/material';

export default function AboutUs() {
  return (
    <Box id="onas" sx={{ py: { xs: 6, md: 8 } }}>
      <Container>
        <Paper variant="outlined" sx={{ p: { xs: 3, md: 5 }, background: 'linear-gradient(0deg, #F4FEFE, #FFFFFF)' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} gap={3} alignItems="center">
            <Box
              sx={{
                flex: 1,
                height: { xs: 220, md: 280 },
                backgroundImage: `url(/team.jpg)`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                borderRadius: 3,
              }}
              aria-label="Tým Dogpoint"
            />
            <Stack flex={1} gap={1.5}>
              <Typography variant="h4" sx={{ fontWeight: 900 }}>
                Kdo jsme.
              </Typography>
              <Typography color="text.secondary">
                Dogpoint o. p. s. pomáhá opuštěným a týraným pejskům nejen nacházet domovy, ale také je na tento „nový“ život
                připravit. Poskytujeme dočasný azyl, péči a resocializaci. Dálková adopce umožňuje průběžně financovat péči a
                sdílet sponzorům radost z pokroku.
              </Typography>
            </Stack>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}