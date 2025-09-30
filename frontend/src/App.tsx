// frontend/src/App.tsx
import React from 'react'
import { Routes, Route, Link, Outlet } from 'react-router-dom'
import { Container, Typography, Button } from '@mui/material'

// Components
import Header from './components/Header'

// Pages
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

// Guards
import RequireRole from './routes/RequireRole'

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
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
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