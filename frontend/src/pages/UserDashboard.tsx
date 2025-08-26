import React from 'react'
import { Container, Typography, Box, Card, CardContent } from '@mui/material'

const UserDashboard: React.FC = () => {
  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4">Můj účet</Typography>
      <Typography variant="body1" gutterBottom>
        Zde můžete vidět své virtuálně adoptované psy, historii darů a osobní údaje.
      </Typography>
      <Box mt={4}>
        <Card>
          <CardContent>
            <Typography variant="h6">Adoptovaný pes: Fluffy</Typography>
            <Typography variant="body2">Pravidelný měsíční dar: 300 Kč</Typography>
          </CardContent>
        </Card>
      </Box>
    </Container>
  )
}

export default UserDashboard