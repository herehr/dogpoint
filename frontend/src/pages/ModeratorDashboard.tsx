import React from 'react'
import { Container, Typography } from '@mui/material'

const ModeratorDashboard: React.FC = () => {
  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4">Moderátorský panel</Typography>
      <p>Možnost správy zvířat, přidávání fotek a příběhů.</p>
    </Container>
  )
}

export default ModeratorDashboard