// frontend/src/components/Header.tsx
import React from 'react'
import { AppBar, Toolbar, Container, Box, Button } from '@mui/material'
import { Link as RouterLink, useLocation } from 'react-router-dom'

export default function Header() {
  const loc = useLocation()
  const onHome = loc.pathname === '/'

  return (
    <AppBar position="sticky" color="default" elevation={0}>
      <Toolbar>
        <Container maxWidth="lg" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Left: Logo -> Home */}
          <Box component={RouterLink} to="/" sx={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
            <img src="/favicon.ico" alt="Dogpoint" width={28} height={28} style={{ marginRight: 8 }} />
            <Box component="span" sx={{ fontWeight: 900, color: 'inherit' }}>Dogpoint</Box>
          </Box>

          {/* Right: Single Login (hidden on /login) */}
          {!onHome && loc.pathname !== '/login' && (
            <Button component={RouterLink} to="/login" variant="outlined">Login</Button>
          )}
          {onHome && (
            <Button component={RouterLink} to="/login" variant="outlined">Login</Button>
          )}
        </Container>
      </Toolbar>
    </AppBar>
  )
}