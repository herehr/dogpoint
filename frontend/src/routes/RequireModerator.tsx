// frontend/src/routes/RequireModerator.tsx
import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'

export default function RequireModerator({ children }: { children: React.ReactNode }) {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('accessToken') : null
  const loc = useLocation()
  if (!token) return <Navigate to="/moderator/login" replace state={{ from: loc }} />
  return <>{children}</>
}