// frontend/src/App.tsx
import React from 'react'
import { Outlet, Link } from 'react-router-dom'
import { AppBar, Toolbar, Button, Container, Stack } from '@mui/material'

export default function AppLayout() {
  return (
    <>
      <AppBar position="sticky" color="default" elevation={0}>
        <Toolbar>
          <Container maxWidth="lg" sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Stack direction="row" spacing={1}>
              <Button component={Link} to="/" color="primary">Domů</Button>
              <Button component={Link} to="/zvirata" color="primary">Zvířata</Button>
              <Button component={Link} to="/admin" color="primary">Admin</Button>
            </Stack>
          </Container>
        </Toolbar>
      </AppBar>
      <Outlet />
    </>
  )
}