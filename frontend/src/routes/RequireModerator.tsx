// frontend/src/routes/RequireModerator.tsx
import React from 'react'
import { Navigate } from 'react-router-dom'
import { getToken } from '../services/api'

export default function RequireModerator({ children }: { children: JSX.Element }) {
  const token = typeof window !== 'undefined' ? getToken() : null

  if (!token) return <Navigate to="/moderator/login" replace />
  return children
}