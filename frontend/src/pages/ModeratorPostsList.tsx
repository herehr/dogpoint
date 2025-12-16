import React from 'react'
import { Container, Typography, Stack, Button, Box } from '@mui/material'
import { Link, useSearchParams } from 'react-router-dom'

export default function ModeratorPostsList() {
  const [params] = useSearchParams()
  const tab = params.get('tab') || 'pending'

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 900 }}>
          Příspěvky
        </Typography>

        <Button component={Link} to="/moderator/posts/novy" variant="contained">
          Nový příspěvek
        </Button>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
        <Button
          component={Link}
          to="/moderator/posts?tab=pending"
          variant={tab === 'pending' ? 'contained' : 'outlined'}
        >
          Ke schválení
        </Button>

        <Button
          component={Link}
          to="/moderator/posts?tab=approved"
          variant={tab === 'approved' ? 'contained' : 'outlined'}
        >
          Schválené
        </Button>

        <Button
          component={Link}
          to="/moderator/posts?tab=rejected"
          variant={tab === 'rejected' ? 'contained' : 'outlined'}
        >
          Zamítnuté
        </Button>
      </Stack>

      <Box sx={{ mt: 4 }}>
        <Typography color="text.secondary">
          Zde bude seznam příspěvků ({tab}).  
          Další krok: napojení API + schválení / zamítnutí.
        </Typography>
      </Box>
    </Container>
  )
}