import React from 'react'
import { Container, Typography, Box, Button } from '@mui/material'
import { Link } from 'react-router-dom'

const HomePage: React.FC = () => {
  return (
    <Container maxWidth="md" sx={{ textAlign: 'center', py: 6 }}>
      <Typography variant="h2" gutterBottom>Virtuální adopce psů</Typography>
      <Typography variant="h5" color="text.secondary" gutterBottom>
        Pomozte psům v útulku Dogpoint najít nový domov. Staňte se jejich virtuálním adoptivním rodičem.
      </Typography>
      <Box mt={4}>
        <Button component={Link} to="/zvirata" variant="contained" size="large">
          Prohlédnout psy k adopci
        </Button>
      </Box>
    </Container>
  )
}

export default HomePage