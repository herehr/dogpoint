// frontend/src/App.tsx
import React from 'react'
import { Routes, Route, Link, Outlet, Navigate } from 'react-router-dom'
import { AppBar, Toolbar, Button, Container, Stack } from '@mui/material'

// Pages
import HomePage from './pages/HomePage'
import AnimalsPage from './pages/AnimalsPage'
import AdminLogin from './pages/AdminLogin'
import ModeratorLogin from './pages/ModeratorLogin'

function AppLayout() {
  return (
    <>
      <AppBar position="sticky" color="default" elevation={0}>
        <Toolbar>
          <Container maxWidth="lg" sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Stack direction="row" spacing={1}>
              <Button component={Link} to="/" color="primary">Domů</Button>
              <Button component={Link} to="/zvirata" color="primary">Zvířata</Button>
              <Button component={Link} to="/admin/login" color="primary">Admin</Button>
              <Button component={Link} to="/moderator/login" color="primary">Moderátor</Button>
            </Stack>
          </Container>
        </Toolbar>
      </AppBar>
      <Outlet />
    </>
  )
}

function NotFound() {
  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <h2>Stránka nenalezena (404)</h2>
      <p>Zkontrolujte adresu nebo přejděte na domovskou stránku.</p>
      <Button component={Link} to="/" variant="contained">Zpět na domů</Button>
    </Container>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/zvirata" element={<AnimalsPage />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin-login" element={<Navigate to="/admin/login" replace />} />
        <Route path="/moderator/login" element={<ModeratorLogin />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}