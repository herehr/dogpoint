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
import AdminStatistics from './pages/AdminStatistics'
import AdminStats from './pages/AdminStats'
import AdminDashboardOverview from './pages/AdminDashboardOverview'
import AnimalsManager from './pages/AnimalsManager'
import ModeratorDashboard from './pages/ModeratorDashboard'
import ModeratorAnimals from './pages/ModeratorAnimals'
import ModeratorPostsList from './pages/ModeratorPostsList'
import ModeratorNewPost from './pages/ModeratorNewPost'
import Login from './pages/Login'
import UserDashboard from './pages/UserDashboard'
import AdoptionStart from './pages/AdoptionStart'
import OchranaOsobnichUdaju from './pages/OchranaOsobnichUdaju'
import NotificationsPage from './pages/NotificationsPage'
import UXPrototype from './prototypes/UXPrototype'
import ResetPassword from './pages/ResetPassword'
import SetPasswordFromInvite from './pages/SetPasswordFromInvite'

import 'react-quill/dist/quill.snow.css'

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

  // Legacy Stripe redirect logic
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
    }
  }, [location.search, navigate])

  return (
    <Routes>
      {/* DIRECT ROUTES */}
      <Route path="/adopce/:id" element={<AdoptionStart />} />
      <Route path="/obnovit-heslo" element={<ResetPassword />} />

      {/* ROOT layout */}
      <Route path="/" element={<AppLayout />}>
        {/* Public */}
        <Route index element={<LandingPage />} />
        <Route path="zvirata" element={<AnimalsPage />} />
        <Route path="zvire/:id" element={<AnimalDetail />} />
        <Route path="zvirata/:id" element={<AnimalDetail />} />
        <Route path="ochrana-osobnich-udaju" element={<OchranaOsobnichUdaju />} />
        <Route path="notifikace" element={<NotificationsPage />} />
        <Route path="/nastavit-heslo" element={<SetPasswordFromInvite />} />


        {/* Auth */}
        <Route path="login" element={<Login />} />

        {/* ADMIN */}
        <Route
          path="admin"
          element={
            <RequireRole roles={['ADMIN']}>
              <AdminDashboard />
            </RequireRole>
          }
        />

        <Route
          path="admin/dashboard"
          element={
            <RequireRole roles={['ADMIN']}>
              <AdminDashboardOverview />
            </RequireRole>
          }
        />

        <Route
          path="admin/statistiky"
          element={
           <RequireRole roles={['ADMIN']}>
            <AdminStatistics />
           </RequireRole>
          }
        />

        <Route
          path="admin/stats"
          element={
            <RequireRole roles={['ADMIN']}>
              <AdminStats />
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


        {/* MODERATOR */}
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
              <ModeratorAnimals />
            </RequireRole>
          }
        />

        <Route
          path="moderator/zvirata-sprava"
          element={
            <RequireRole roles={['MODERATOR', 'ADMIN']}>
              <AnimalsManager />
            </RequireRole>
          }
        />

        <Route
          path="moderator/pridat"
          element={
            <RequireRole roles={['MODERATOR', 'ADMIN']}>
              <AnimalsManager />
            </RequireRole>
          }
        />

        {/* POSTS */}
        <Route
          path="moderator/posts"
          element={
            <RequireRole roles={['MODERATOR', 'ADMIN']}>
              <ModeratorPostsList />
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

        {/* USER */}
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