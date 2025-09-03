// frontend/src/pages/AdminDashboard.tsx
import React from 'react'
import { Container, Typography, Paper, Grid, Button, Stack } from '@mui/material'
import PeopleIcon from '@mui/icons-material/People'
import PetsIcon from '@mui/icons-material/Pets'
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary'
import DescriptionIcon from '@mui/icons-material/Description'
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
        {/* Zvířata — now enabled */}
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
                to="/admin/animals"   // ✅ LINK
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

        {/* Placeholders */}
        <Grid item xs={12} sm={6} md={4}>
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, height: '100%' }}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <PhotoLibraryIcon />
                <Typography variant="h6" sx={{ fontWeight: 800 }}>Galerie</Typography>
              </Stack>
              <Typography color="text.secondary">Soubory a obrázky ke zvířatům.</Typography>
              <Button disabled size="small" variant="outlined" sx={{ alignSelf: 'flex-start' }}>
                Brzy
              </Button>
            </Stack>
          </Paper>
        </Grid>

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