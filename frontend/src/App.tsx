// frontend/src/App.tsx
import React from 'react'
import { Routes, Route, Link, Outlet, Navigate } from 'react-router-dom'
import { AppBar, Toolbar, Button, Container, Stack, Typography } from '@mui/material'

// Pages
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import AdminLogin from './pages/AdminLogin'            // kept for backward-compat (optional)
import AdminDashboard from './pages/AdminDashboard'
import AdminModerators from './pages/AdminModerators'
import ModeratorLogin from './pages/ModeratorLogin'    // kept for backward-compat (optional)
import ModeratorDashboard from './pages/ModeratorDashboard'
import AnimalsManager from './pages/AnimalsManager'

// Guards
import RequireModerator from './routes/RequireModerator'
import RequireAdmin from './routes/RequireAdmin'

function AppLayout() {
  return (
    <>
      <AppBar position="sticky" color="default" elevation={0}>
        <Toolbar>
          <Container maxWidth="lg" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Button component={Link} to="/" color="inherit" sx={{ px: 0, minWidth: 0 }}>
              <Typography variant="h6" sx={{ fontWeight: 900 }}>Dogpoint</Typography>
            </Button>

            {/* single Login on the right */}
            <Stack direction="row" spacing={1}>
              <Button component={Link} to="/login" color="primary" variant="text">
                Login
              </Button>
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
        {/* Public */}
        <Route path="/" element={<HomePage />} />

        {/* Unified Login (detects role and redirects) */}
        <Route path="/login" element={<LoginPage />} />

        {/* Admin */}
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

        {/* Moderator */}
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

        {/* Old links → keep graceful redirects (optional) */}
        <Route path="/admin/login" element={<Navigate to="/login" replace />} />
        <Route path="/moderator/login" element={<Navigate to="/login" replace />} />
        <Route path="/admin-login" element={<Navigate to="/login" replace />} />
        <Route path="/zvirata" element={<Navigate to="/#novinky" replace />} />

        {/* Fallback */}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}