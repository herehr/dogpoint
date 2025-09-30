// frontend/src/components/Header.tsx
import React from 'react'
import { Link } from 'react-router-dom'
import { Box, Container, Stack, Button } from '@mui/material'

export default function Header() {
  return (
    <Box
      sx={{
        position: 'relative',
        background: 'linear-gradient(135deg, #00bcd4 0%, #00acc1 100%)', // turquoise gradient
        color: '#fff',
        pb: 6, // padding bottom for wave
      }}
    >
      <Container
        maxWidth="lg"
        sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 2 }}
      >
        {/* Logo */}
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
          <img src="/logo1.png" alt="Dogpoint Logo" style={{ height: 40, marginRight: 8 }} />
        </Link>

        {/* Menu */}
        <Stack direction="row" spacing={3}>
          <Button component={Link} to="/jak-to-funguje" color="inherit">JAK TO FUNGUJE</Button>
          <Button component={Link} to="/zvirata" color="inherit">ADOPCE</Button>
          <Button component={Link} to="/o-nas" color="inherit">O NÁS</Button>
          <Button component={Link} to="/login" color="inherit">PŘIHLÁŠENÍ</Button>
        </Stack>
      </Container>

      {/* Wave border at bottom */}
      <Box
        component="svg"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1440 100"
        preserveAspectRatio="none"
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: 100,
          display: 'block',
        }}
      >
        <path
          fill="#ffffff"
          stroke="#ffffff"
          strokeWidth="5"
          d="M0,64 C480,160 960,0 1440,96 L1440,320 L0,320 Z"
        />
      </Box>
    </Box>
  )
}