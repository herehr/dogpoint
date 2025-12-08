// frontend/src/pages/AdminDashboard.tsx
import React from 'react'
import { Container, Typography, Paper, Grid, Button, Stack } from '@mui/material'
import PeopleIcon from '@mui/icons-material/People'
import PetsIcon from '@mui/icons-material/Pets'
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary'
import DescriptionIcon from '@mui/icons-material/Description'
import BarChartIcon from '@mui/icons-material/BarChart'
import { Link as RouterLink } from 'react-router-dom'

export default function AdminDashboard() {
  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Typography variant="h5" sx={{ fontWeight: 900, mb: 2 }}>
        Admin panel
      </Typography>

      <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, mb: 3 }}>
        <Typography color="text.secondary">
          Úspěšné přihlášení. Vyberte sekci k správě.
        </Typography>
      </Paper>

      <Grid container spacing={2}>
        {/* Zvířata */}
        <Grid item xs={12} sm={6} md={4}>
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, height: '100%' }}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <PetsIcon />
                <Typography variant="h6" sx={{ fontWeight: 800 }}>Zvířata</Typography>
              </Stack>
              <Typography color="text.secondary">
                Přehled a správa záznamů zvířat.
              </Typography>
              <Button
                component={RouterLink}
                to="/admin/animals"
                variant="contained"
                size="small"
                sx={{ alignSelf: 'flex-start' }}
              >
                Otevřít
              </Button>
            </Stack>
          </Paper>
        </Grid>

        {/* Moderátoři */}
        <Grid item xs={12} sm={6} md={4}>
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, height: '100%' }}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <PeopleIcon />
                <Typography variant="h6" sx={{ fontWeight: 800 }}>Moderátoři</Typography>
              </Stack>
              <Typography color="text.secondary">
                Přidávat/mazat moderátory a resetovat hesla.
              </Typography>
              <Button
                component={RouterLink}
                to="/admin/moderators"
                variant="contained"
                size="small"
                sx={{ alignSelf: 'flex-start' }}
              >
                Otevřít
              </Button>
            </Stack>
          </Paper>
        </Grid>

        {/* Statistiky — EXISTING */}
        <Grid item xs={12} sm={6} md={4}>
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, height: '100%' }}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <BarChartIcon />
                <Typography variant="h6" sx={{ fontWeight: 800 }}>Statistiky</Typography>
              </Stack>
              <Typography color="text.secondary">
                Přehled plateb, příslibů a očekávaných měsíčních příjmů.
              </Typography>
              <Button
                component={RouterLink}
                to="/admin/stats"
                variant="contained"
                size="small"
                sx={{ alignSelf: 'flex-start' }}
              >
                Otevřít
              </Button>
            </Stack>
          </Paper>
        </Grid>

        {/* NOVÉ: Ke schválení (zvířata + příspěvky) */}
        <Grid item xs={12} sm={6} md={4}>
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, height: '100%' }}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <DescriptionIcon />
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Zvířata a příspěvky ke schválení
                </Typography>
              </Stack>
              <Typography color="text.secondary">
                Přehled zvířat a příspěvků, které čekají na schválení moderátorem nebo
                administrátorem.
              </Typography>
              <Button
                component={RouterLink}
                to="/moderator/animals?tab=pending"
                variant="contained"
                size="small"
                sx={{ alignSelf: 'flex-start' }}
              >
                Otevřít
              </Button>
            </Stack>
          </Paper>
        </Grid>

        {/* Galerie (placeholder) */}
        <Grid item xs={12} sm={6} md={4}>
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, height: '100%' }}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <PhotoLibraryIcon />
                <Typography variant="h6" sx={{ fontWeight: 800 }}>Galerie</Typography>
              </Stack>
              <Typography color="text.secondary">
                Soubory a obrázky ke zvířatům.
              </Typography>
              <Button disabled size="small" variant="outlined" sx={{ alignSelf: 'flex-start' }}>
                Brzy
              </Button>
            </Stack>
          </Paper>
        </Grid>

        {/* Adopce (placeholder) */}
        <Grid item xs={12} sm={6} md={4}>
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, height: '100%' }}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <DescriptionIcon />
                <Typography variant="h6" sx={{ fontWeight: 800 }}>Adopce</Typography>
              </Stack>
              <Typography color="text.secondary">Správa žádostí o adopci.</Typography>
              <Button disabled size="small" variant="outlined" sx={{ alignSelf: 'flex-start' }}>
                Brzy
              </Button>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  )
}