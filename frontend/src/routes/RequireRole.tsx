import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function RequireRole({ role, children }: { role: 'ADMIN'|'MODERATOR'|'USER'; children: React.ReactNode }) {
  const { token, role: myRole } = useAuth()
  const location = useLocation()
  if (!token || myRole !== role) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return <>{children}</>
}