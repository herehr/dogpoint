// frontend/src/App.tsx
import React from 'react'
import { Routes, Route, Link, Outlet, Navigate, useNavigate } from 'react-router-dom'
import { AppBar, Toolbar, Button, Container, Stack, Typography } from '@mui/material'

// Pages
import HomePage from './pages/HomePage'
import AnimalsPage from './pages/AnimalsPage'
import AnimalDetail from './pages/AnimalDetail'
import AdminDashboard from './pages/AdminDashboard'
import AdminModerators from './pages/AdminModerators'
import ModeratorDashboard from './pages/ModeratorDashboard'
import AnimalsManager from './pages/AnimalsManager'
import UXPrototype from './prototypes/UXPrototype'
import Login from './pages/Login'
import UserDashboard from './pages/UserDashboard'

// Guards
import RequireRole from './routes/RequireRole'
import { useAuth } from './context/AuthContext'
import UserAccount from './pages/UserAccount'
import PrivateRoute from './components/PrivateRoute'

function AppLayout() {
  const { token, role, logout } = useAuth()
  const navigate = useNavigate()

  function onLogout() {
    logout()
    navigate('/', { replace: true })
  }

  const dashboardHref =
    role === 'ADMIN'
      ? '/admin'
      : role === 'MODERATOR'
      ? '/moderator'
      : role === 'USER'
      ? '/user'
      : '/login'

  return (
    <>
      <AppBar position="sticky" color="default" elevation={0}>
        <Toolbar>
          <Container maxWidth="lg" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {/* Left: Logo → Home */}
           <Button
  component={Link}
  to="/"
  color="inherit"
  sx={{ px: 0, minWidth: 'auto' }}
>
  <img
    src="/logo1.png"
    alt="Dogpoint Logo"
    style={{ height: 30, objectFit: 'contain', display: 'block' }}
  />
</Button>

            {/* Right: Single Login (or dashboard + logout when authed) */}
            <Stack direction="row" spacing={1}>
              {!token ? (
                <Button component={Link} to="/login" variant="contained">
                  Přihlásit
                </Button>
              ) : (
                <>
                  <Button component={Link} to={dashboardHref} variant="outlined">
                    {role === 'ADMIN'
                      ? 'Admin'
                      : role === 'MODERATOR'
                      ? 'Moderátor'
                      : 'Můj účet'}
                  </Button>
                  <Button onClick={onLogout} color="inherit">
                    Odhlásit
                  </Button>
                </>
              )}
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
      <Typography variant="h5" sx={{ fontWeight: 900, mb: 1 }}>
        Stránka nenalezena (404)
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Zkontrolujte adresu nebo přejděte na domovskou stránku.
      </Typography>
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
        <Route path="/zvirata" element={<AnimalsPage />} />
        <Route path="/zvirata/:id" element={<AnimalDetail />} />

        {/* Single login page for all roles */}
        <Route path="/login" element={<Login />} />

        {/* Admin */}
        <Route
          path="/admin"
          element={
            <RequireRole roles={['ADMIN']}>
              <AdminDashboard />
            </RequireRole>
          }
        />
        <Route
          path="/admin/moderators"
          element={
            <RequireRole roles={['ADMIN']}>
              <AdminModerators />
            </RequireRole>
          }
        />
        <Route
          path="/admin/animals"
          element={
            <RequireRole roles={['ADMIN']}>
              <AnimalsManager />
            </RequireRole>
          }
        />

        {/* Moderator */}
        <Route
          path="/moderator"
          element={
            <RequireRole roles={['MODERATOR', 'ADMIN']}>
              <ModeratorDashboard />
            </RequireRole>
          }
        />
        <Route
          path="/moderator/animals"
          element={
            <RequireRole roles={['MODERATOR', 'ADMIN']}>
              <AnimalsManager />
            </RequireRole>
          }
        />

        {/* User */}

<Route
  path="/user"
  element={
    <RequireRole roles={['USER', 'MODERATOR', 'ADMIN']}>
      <UserDashboard />
    </RequireRole>
  }
/>

        {/* Prototype (optional) */}
        <Route path="/proto/*" element={<UXPrototype />} />

        {/* Fallback */}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}