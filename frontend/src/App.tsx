// frontend/src/App.tsx
import React from 'react'
import { Routes, Route, Outlet, Navigate } from 'react-router-dom'
import { Container, Button } from '@mui/material'

import Header from './components/Header'

// Pages
import HomePage from './pages/HomePage'
import AdminLogin from './pages/AdminLogin' // will be replaced by unified login below, but keep for now
import AdminDashboard from './pages/AdminDashboard'
import AdminModerators from './pages/AdminModerators'
import ModeratorLogin from './pages/ModeratorLogin' // will be replaced by unified login below, but keep for now
import ModeratorDashboard from './pages/ModeratorDashboard'
import AnimalsManager from './pages/AnimalsManager'
import AnimalDetail from './pages/AnimalDetail'
import Login from './pages/Login' // NEW unified login

// Guards
import RequireModerator from './routes/RequireModerator'
import RequireAdmin from './routes/RequireAdmin'

function AppLayout() {
  return (
    <>
      <Header />
      <Outlet />
    </>
  )
}

function NotFound() {
  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <h2>Stránka nenalezena (404)</h2>
      <p>Zkontrolujte adresu nebo přejděte na domovskou stránku.</p>
      <Button href="/" variant="contained">Zpět na domů</Button>
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

        {/* Unified Login */}
        <Route path="/login" element={<Login />} />
        <Route path="/admin/login" element={<Navigate to="/login" replace />} />
        <Route path="/moderator/login" element={<Navigate to="/login" replace />} />

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

        {/* Fallback */}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}