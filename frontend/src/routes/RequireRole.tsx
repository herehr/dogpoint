import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

type Props = { roles: Array<'ADMIN' | 'MODERATOR' | 'USER'> }

export default function RequireRole({ roles }: Props) {
  const { token, role } = useAuth()
  const loc = useLocation()

  // Not logged in
  if (!token) return <Navigate to="/login" replace state={{ from: loc }} />

  // Logged in but role not allowed
  if (!role || !roles.includes(role)) {
    // Redirect users to their home based on role if present
    if (role === 'ADMIN') return <Navigate to="/admin" replace />
    if (role === 'MODERATOR') return <Navigate to="/moderator" replace />
    if (role === 'USER') return <Navigate to="/user" replace />
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}