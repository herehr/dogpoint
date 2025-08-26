import React from 'react'
import { Container, Typography } from '@mui/material'

const AdminDashboard: React.FC = () => {
  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4">Admin panel</Typography>
      <p>Správa moderátorů, uživatelů a obsahu celé aplikace.</p>
    </Container>
  )
}

export default AdminDashboard