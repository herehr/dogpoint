// frontend/src/App.tsx
import React, { useEffect } from 'react'
import {
  Routes,
  Route,
  Link,
  Outlet,
  useNavigate,
  useLocation,
} from 'react-router-dom'
import { Container, Typography, Button } from '@mui/material'

/** Route guard for roles */
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
import AdoptionStart from './pages/AdoptionStart'
import OchranaOsobnichUdaju from './pages/OchranaOsobnichUdaju'
import NotificationsPage from './pages/NotificationsPage'
import 'react-quill/dist/quill.snow.css'
import ModeratorNewPost from './pages/ModeratorNewPost'
import ModeratorAnimals from './pages/ModeratorAnimals'
import AddAnimal from './pages/AddAnimal'   // ✅ RESTORED IMPORT

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

  // Stripe redirect handler
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const paid = params.get('paid')
    const canceled = params.get('canceled')
    const pending = params.get('pending')
    const animal = params.get('animal')

    if (animal && (paid === '1' || pending === '1')) {
      try {
        localStorage.setItem('dp:justPaid', '1')
        localStorage.setItem(`dp:unlock:${animal}`, '1')
      } catch {}

      navigate(`/zvirata/${encodeURIComponent(animal)}?paid=1`, {
        replace: true,
      })
      return
    }

    if (animal && canceled === '1') {
      navigate(`/zvirata/${encodeURIComponent(animal)}?canceled=1`, {
        replace: true,
      })
      return
    }
  }, [location.search, navigate])

  return (
    <Routes>
      {/* Absolute adoption route */}
      <Route path="/adopce/:id" element={<AdoptionStart />} />

      {/* Layout root */}
      <Route path="/" element={<AppLayout />}>
        {/* Public */}
        <Route index element={<LandingPage />} />
        <Route path="zvirata" element={<AnimalsPage />} />
        <Route path="zvire/:id" element={<AnimalDetail />} />
        <Route path="zvirata/:id" element={<AnimalDetail />} />
        <Route path="adopce/:id" element={<AdoptionStart />} />
        <Route path="ochrana-osobnich-udaju" element={<OchranaOsobnichUdaju />} />
        <Route path="notifikace" element={<NotificationsPage />} />

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

        {/* 🆕 Moderator animals (published + pending) */}
        <Route
          path="moderator/animals"
          element={
            <RequireRole roles={['MODERATOR', 'ADMIN']}>
              <ModeratorAnimals />
            </RequireRole>
          }
        />

        {/* 🆕 ADD ANIMAL restored */}
        <Route
          path="moderator/pridat"
          element={
            <RequireRole roles={['MODERATOR', 'ADMIN']}>
              <AddAnimal />
            </RequireRole>
          }
        />

        <Route
          path="moderator/posts/novy"
          element={
            <RequireRole roles={['MODERATOR', 'ADMIN']}>
              <ModeratorNewPost />
            </RequireRole>
          }
        />

        {/* User Dashboard */}
        <Route
          path="user"
          element={
            <RequireRole roles={['USER', 'MODERATOR', 'ADMIN']}>
              <UserDashboard />
            </RequireRole>
          }
        />

        {/* Playground */}
        <Route path="proto/*" element={<UXPrototype />} />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}