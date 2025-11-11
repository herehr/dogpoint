// frontend/src/App.tsx
import React, { useEffect } from 'react'
import { Routes, Route, Link, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Container, Typography, Button } from '@mui/material'

/** Correct location of RequireRole */
import RequireRole from './routes/RequireRole'

/** Layout */
import Header from './components/Header'

/** Pages */
import LandingPage from './pages/LandingPage'
import AnimalsPage from './pages/AnimalsPage'
import AnimalDetail from './pages/AnimalDetail'
import AdminDashboard from './pages/AdminDashboard'
import AdminModerators from './pages/AdminModerators'
import ModeratorDashboard from './pages/ModeratorDashboard'
import AnimalsManager from './pages/AnimalsManager'
import UXPrototype from './prototypes/UXPrototype'
import Login from './pages/Login'
import UserDashboard from './pages/UserDashboard'
import OchranaOsobnichUdaju from './pages/OchranaOsobnichUdaju'

function AppLayout() {
  return (
    <>
      <Header logoSrc="/logo1.png" />
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
      <Button component={Link} to="/" variant="contained">
        Zpět na domů
      </Button>
    </Container>
  )
}

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()

  // If Stripe ever lands you at /?paid=1&animal=XYZ (legacy), forward to the SPA route
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const paid = params.get('paid')
    const canceled = params.get('canceled')
    const animal = params.get('animal')
    if ((paid === '1' || canceled === '1') && animal) {
      try { if (paid === '1') localStorage.setItem('dp:justPaid', '1') } catch {}
      const to = `/zvirata/${encodeURIComponent(animal)}${paid === '1' ? '?paid=1' : '?canceled=1'}`
      navigate(to, { replace: true })
    }
  }, [location.search, navigate])

  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<LandingPage />} />

        {/* Public */}
        <Route path="zvirata" element={<AnimalsPage />} />
        <Route path="zvirata/:id" element={<AnimalDetail />} />
        <Route path="ochrana-osobnich-udaju" element={<OchranaOsobnichUdaju />} />

        {/* Auth */}
        <Route path="login" element={<Login />} />

        {/* Admin */}
        <Route
          path="admin"
          element={
            <RequireRole roles={['ADMIN']}>
              <AdminDashboard />
            </RequireRole>
          }
        />
        <Route
          path="admin/moderators"
          element={
            <RequireRole roles={['ADMIN']}>
              <AdminModerators />
            </RequireRole>
          }
        />
        <Route
          path="admin/animals"
          element={
            <RequireRole roles={['ADMIN']}>
              <AnimalsManager />
            </RequireRole>
          }
        />

        {/* Moderator */}
        <Route
          path="moderator"
          element={
            <RequireRole roles={['MODERATOR', 'ADMIN']}>
              <ModeratorDashboard />
            </RequireRole>
          }
        />
        <Route
          path="moderator/animals"
          element={
            <RequireRole roles={['MODERATOR', 'ADMIN']}>
              <AnimalsManager />
            </RequireRole>
          }
        />

        {/* User */}
        <Route
          path="user"
          element={
            <RequireRole roles={['USER', 'MODERATOR', 'ADMIN']}>
              <UserDashboard />
            </RequireRole>
          }
        />

        {/* Prototype */}
        <Route path="proto/*" element={<UXPrototype />} />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}