// frontend/src/pages/ModeratorDashboard.tsx
import React from 'react'
import {
  Container,
  Typography,
  Grid,
  Card,
  CardActionArea,
  CardContent,
  Stack,
  Button,
} from '@mui/material'

import PetsIcon from '@mui/icons-material/Pets'
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate'
import PostAddIcon from '@mui/icons-material/PostAdd'
import { Link as RouterLink } from 'react-router-dom'

export default function ModeratorDashboard() {
  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 3 }}
      >
        <Typography variant="h5" sx={{ fontWeight: 900 }}>
          Moderátorský panel
        </Typography>
        <Button
          component={RouterLink}
          to="/moderator/animals"
          variant="contained"
          startIcon={<PetsIcon />}
        >
          Správa zvířat
        </Button>
      </Stack>

      <Grid container spacing={2}>
        {/* Zvířata */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardActionArea component={RouterLink} to="/moderator/animals">
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <PetsIcon />
                  <div>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      Zvířata
                    </Typography>
                    <Typography color="text.secondary">
                      Přidání, úprava, smazání. Fotky a galerie.
                    </Typography>
                  </div>
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>

        {/* Nahrát fotografie */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardActionArea component={RouterLink} to="/moderator/animals">
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <AddPhotoAlternateIcon />
                  <div>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      Nahrát fotografie
                    </Typography>
                    <Typography color="text.secondary">
                      Rychlé nahrání fotek k vybranému zvířeti.
                    </Typography>
                  </div>
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>

        {/* Příběhy / příspěvky */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardActionArea component={RouterLink} to="/moderator/posts/novy">
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <PostAddIcon />
                  <div>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      Příběhy / příspěvky
                    </Typography>
                    <Typography color="text.secondary">
                      Po adopci přidávejte novinky k danému zvířeti.
                    </Typography>
                  </div>
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>

        {/* 🔴 NEW: Zvířata ke schválení (pending tab entry) */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            {/* You can later implement /moderator/animals?tab=pending
               or a dedicated route like /moderator/animals/pending */}
            <CardActionArea component={RouterLink} to="/moderator/animals?tab=pending">
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <PetsIcon />
                  <div>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      Zvířata ke schválení
                    </Typography>
                    <Typography color="text.secondary">
                      Přehled zvířat, která čekají na schválení moderátorem nebo
                      administrátorem.
                    </Typography>
                  </div>
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
      </Grid>
    </Container>
  )
}