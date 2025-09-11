import React from 'react'
import { Routes, Route, Link, Outlet, Navigate, useNavigate } from 'react-router-dom'
import { AppBar, Toolbar, Button, Container, Stack, Typography } from '@mui/material'

// Pages
import HomePage from './pages/HomePage'
import AnimalsPage from './pages/AnimalsPage'
import AdminLogin from './pages/AdminLogin'           // (you can delete later if not needed)
import AdminDashboard from './pages/AdminDashboard'
import AdminModerators from './pages/AdminModerators'
import ModeratorLogin from './pages/ModeratorLogin'   // (you can delete later if not needed)
import ModeratorDashboard from './pages/ModeratorDashboard'
import AnimalsManager from './pages/AnimalsManager'
import UXPrototype from './prototypes/UXPrototype'
import Login from './pages/Login'
import UserDashboard from './pages/UserDashboard'

// Guards
import RequireRole from './routes/RequireRole'
import { useAuth } from './context/AuthContext'

function AppLayout() {
  const { token, role, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <>
      <AppBar position="sticky" color="default" elevation={0}>
        <Toolbar>
          <Container maxWidth="lg" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography
              component={Link}
              to="/"
              sx={{ textDecoration: 'none', color: 'inherit', fontWeight: 900 }}
            >
              Dogpoint
            </Typography>

            <Stack direction="row" spacing={1}>
              {!token ? (
                <Button component={Link} to="/login" color="primary">Login</Button>
              ) : (
                <>
                  {role === 'ADMIN' && <Button component={Link} to="/admin" color="primary">Admin</Button>}
                  {role === 'MODERATOR' && <Button component={Link} to="/moderator" color="primary">Moderátor</Button>}
                  {role === 'USER' && <Button component={Link} to="/user" color="primary">Můj účet</Button>}
                  <Button
                    color="inherit"
                    onClick={() => { logout(); navigate('/', { replace: true }) }}
                  >
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
        {/* If you still want a listing page */}
        <Route path="/zvirata" element={<AnimalsPage />} />

        {/* Unified login */}
        <Route path="/login" element={<Login />} />

        {/* Admin */}
        <Route
          path="/admin"
          element={
            <RequireRole role="ADMIN">
              <AdminDashboard />
            </RequireRole>
          }
        />
        <Route
          path="/admin/moderators"
          element={
            <RequireRole role="ADMIN">
              <AdminModerators />
            </RequireRole>
          }
        />
        <Route
          path="/admin/animals"
          element={
            <RequireRole role="ADMIN">
              <AnimalsManager />
            </RequireRole>
          }
        />

        {/* Moderator */}
        <Route
          path="/moderator"
          element={
            <RequireRole role="MODERATOR">
              <ModeratorDashboard />
            </RequireRole>
          }
        />
        <Route
          path="/moderator/animals"
          element={
            <RequireRole role="MODERATOR">
              <AnimalsManager />
            </RequireRole>
          }
        />

        {/* User */}
        <Route
          path="/user"
          element={
            <RequireRole role="USER">
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