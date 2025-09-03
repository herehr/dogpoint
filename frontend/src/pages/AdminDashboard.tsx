// frontend/src/pages/AdminDashboard.tsx
import React from 'react'
import { Container, Typography, Paper } from '@mui/material'

export default function AdminDashboard() {
  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Typography variant="h5" sx={{ fontWeight: 900, mb: 2 }}>
        Admin panel
      </Typography>
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
        <Typography color="text.secondary">
          Úspěšné přihlášení. Sem přijde správa dat (zvířata, galerie, adopce, uživatelé…)
        </Typography>
      </Paper>
    </Container>
  )
}