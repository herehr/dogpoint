// frontend/src/App.tsx
import React from 'react'
import { Routes, Route, Link, Outlet, Navigate } from 'react-router-dom'
import { AppBar, Toolbar, Button, Container, Stack } from '@mui/material'

// Pages
import HomePage from './pages/HomePage'
import AnimalsPage from './pages/AnimalsPage'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import AdminModerators from './pages/AdminModerators'
import ModeratorLogin from './pages/ModeratorLogin'
import ModeratorDashboard from './pages/ModeratorDashboard'
import AnimalsManager from './pages/AnimalsManager'   // ✅ IMPORT

// Guards
import RequireModerator from './routes/RequireModerator'
import RequireAdmin from './routes/RequireAdmin'

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
        {/* Public */}
        <Route path="/" element={<HomePage />} />
        <Route path="/zvirata" element={<AnimalsPage />} />

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
          path="/admin/animals"                     // ✅ ROUTE
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
          path="/moderator/animals"                 // ✅ (optional for moderators)
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