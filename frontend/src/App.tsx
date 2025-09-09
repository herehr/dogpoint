// frontend/src/App.tsx
import React from 'react'
import { Routes, Route, Link, Outlet } from 'react-router-dom'
import { AppBar, Toolbar, Button, Container, Stack } from '@mui/material'

// Pages
import HomePage from './pages/HomePage'
import AdminLogin from './pages/AdminLogin'
import ModeratorLogin from './pages/ModeratorLogin'
import AdminDashboard from './pages/AdminDashboard'
import ModeratorDashboard from './pages/ModeratorDashboard'
import AnimalsManager from './pages/AnimalsManager' // admin & moderator manager
import AnimalDetail from './pages/AnimalDetail'

// Guards
import RequireModerator from './routes/RequireModerator'
import RequireAdmin from './routes/RequireAdmin'

function AppLayout() {
  return (
    <>
      <AppBar position="sticky" color="default" elevation={0}>
        <Toolbar>
          <Container
            maxWidth="lg"
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            {/* left side empty to keep it minimal */}
            <span />

            {/* right side: only one login entry */}
            <Stack direction="row" spacing={1}>
              <Button component={Link} to="/login" color="primary" variant="outlined">
                Přihlásit
              </Button>
            </Stack>
          </Container>
        </Toolbar>
      </AppBar>
      <Outlet />
    </>
  )
}

function LoginHub() {
  // super simple: let user choose Admin or Moderator for now
  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <h2>Přihlášení</h2>
      <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
        <Button component={Link} to="/admin/login" variant="contained">Admin</Button>
        <Button component={Link} to="/moderator/login" variant="outlined">Moderátor</Button>
      </Stack>
    </Container>
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
        {/* Public */}
        <Route path="/" element={<HomePage />} />
        <Route path="/zvirata/:id" element={<AnimalDetail />} />
        <Route path="/login" element={<LoginHub />} />

        {/* Admin */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminDashboard />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/animals"
          element={
            <RequireAdmin>
              <AnimalsManager />
            </RequireAdmin>
          }
        />

        {/* Moderator */}
        <Route path="/moderator/login" element={<ModeratorLogin />} />
        <Route
          path="/moderator"
          element={
            <RequireModerator>
              <ModeratorDashboard />
            </RequireModerator>
          }
        />
        <Route
          path="/moderator/animals"
          element={
            <RequireModerator>
              <AnimalsManager />
            </RequireModerator>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}