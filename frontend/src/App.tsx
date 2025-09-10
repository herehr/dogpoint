// frontend/src/App.tsx
import React, { useEffect, useState } from 'react'
import { Routes, Route, Link, Outlet, Navigate, useNavigate } from 'react-router-dom'
import { AppBar, Toolbar, Button, Container, Stack } from '@mui/material'

// Pages
import HomePage from './pages/HomePage'
import AnimalsPage from './pages/AnimalsPage'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import AdminModerators from './pages/AdminModerators'
import ModeratorLogin from './pages/ModeratorLogin'
import ModeratorDashboard from './pages/ModeratorDashboard'
import AnimalsManager from './pages/AnimalsManager'
import UXPrototype from './prototypes/UXPrototype'
import AnimalDetail from './pages/AnimalDetail'

// Guards
import RequireModerator from './routes/RequireModerator'
import RequireAdmin from './routes/RequireAdmin'

// Utils
import { logout as apiLogout } from './services/api'
import AutoLogout from './components/AutoLogout'

// --- small hook to track token presence via sessionStorage + our auth event ---
function useAuthToken(): boolean {
  const [hasToken, setHasToken] = useState<boolean>(() => !!sessionStorage.getItem('accessToken'))
  useEffect(() => {
    const onChange = () => setHasToken(!!sessionStorage.getItem('accessToken'))
    window.addEventListener('storage', onChange)
    window.addEventListener('auth:change', onChange)
    return () => {
      window.removeEventListener('storage', onChange)
      window.removeEventListener('auth:change', onChange)
    }
  }, [])
  return hasToken
}

function AppLayout() {
  const hasToken = useAuthToken()
  const navigate = useNavigate()

  function onLogout() {
    apiLogout()
    navigate('/', { replace: true })
  }

  return (
    <>
      <AppBar position="sticky" color="default" elevation={0}>
        <Toolbar>
          <Container maxWidth="lg" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {/* Left: Logo as a link to the landing page */}
            <Button component={Link} to="/" color="inherit" sx={{ fontWeight: 900 }}>
              Dogpoint
            </Button>

            {/* Right: Auth action */}
            <Stack direction="row" spacing={1} alignItems="center">
              {hasToken ? (
                <Button onClick={onLogout} color="primary" variant="outlined">
                  Odhlásit
                </Button>
              ) : (
                // If you later consolidate to a single /login, change the link here.
                <Stack direction="row" spacing={1}>
                  <Button component={Link} to="/admin/login" color="primary">Přihlásit</Button>
                </Stack>
              )}
            </Stack>
          </Container>
        </Toolbar>
      </AppBar>

      {/* global idle watchdog */}
      <AutoLogout />

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
        {/* Public */}
        <Route path="/" element={<HomePage />} />
        <Route path="/zvirata" element={<AnimalsPage />} />
        <Route path="/zvirata/:id" element={<AnimalDetail />} />

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
          path="/admin/moderators"
          element={
            <RequireAdmin>
              <AdminModerators />
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
        <Route path="/admin-login" element={<Navigate to="/admin/login" replace />} />

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

        {/* Prototype (left as-is) */}
        <Route path="/proto/*" element={<UXPrototype />} />

        {/* Fallback */}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}