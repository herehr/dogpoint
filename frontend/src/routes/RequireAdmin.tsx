// frontend/src/routes/RequireAdmin.tsx
import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('adminToken') : null
  const loc = useLocation()
  if (!token) {
    return <Navigate to="/admin/login" replace state={{ from: loc }} />
  }
  return <>{children}</>
}