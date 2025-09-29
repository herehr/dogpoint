// frontend/src/sections/HowItWorks.tsx
import React from 'react';
import { Box, Container, Grid, Paper, Stack, Typography } from '@mui/material';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import DevicesIcon from '@mui/icons-material/Devices';
import PaymentsIcon from '@mui/icons-material/Payments';

const items = [
  {
    icon: <VolunteerActivismIcon fontSize="large" />,
    title: 'Podpoř svého mazlíčka',
    text:
      'Adoptuj si mazlíčka na dálku. Dary svým PRAVIDELNÝM měsíčním příspěvkem zajistí potřeby, krmivo, lékařskou péči a útulkovou zátěž. Změníš tím reálný život zvířat. Někdo mezi nimi může objevit právě TEBE.',
  },
  {
    icon: <DevicesIcon fontSize="large" />,
    title: 'Jde to jednoduše online',
    text:
      'Použij naši aplikaci a budeš celý čas informovaný/a o tom, jak tvůj mazlíček dělá pokroky. Moderátoři přidávají fotky, videa a krátké zprávy.',
  },
  {
    icon: <PaymentsIcon fontSize="large" />,
    title: 'Vyber si měsíční příspěvek',
    text:
      'Každý, kdo jednou přispěje, získává aktualizace a starostlivost navíc. S adopcí na dálku od 100 Kč. 150 Kč, 200 Kč… Přímá pomoc mazlíčkovi a útulku.',
  },
];

export default function HowItWorks() {
  return (
    <Box id="jak" sx={{ py: { xs: 6, md: 8 } }}>
      <Container>
        <Typography variant="h4" sx={{ fontWeight: 900, mb: 3 }}>
          Jak funguje adopce na dálku?
        </Typography>

        <Grid container spacing={2}>
          {items.map((card, i) => (
            <Grid item xs={12} md={4} key={i}>
              <Paper variant="outlined" sx={{ p: 3, height: '100%' }}>
                <Stack gap={1.5}>
                  <Box sx={{ '& svg': { color: 'secondary.main' } }}>{card.icon}</Box>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    {card.title}
                  </Typography>
                  <Typography color="text.secondary">{card.text}</Typography>
                </Stack>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}