// frontend/src/components/ProtectedRoute.tsx
import React from 'react'
import { Navigate } from 'react-router-dom'
import { getToken } from '../services/api'

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const token = typeof window !== 'undefined' ? getToken() : null

  if (!token) return <Navigate to="/login" replace />
  return children
}