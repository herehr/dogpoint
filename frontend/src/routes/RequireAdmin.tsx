// frontend/src/routes/RequireAdmin.tsx
import React from 'react'
import { Navigate } from 'react-router-dom'
import { getToken } from '../services/api'

export default function RequireAdmin({ children }: { children: JSX.Element }) {
  const token = typeof window !== 'undefined' ? getToken() : null

  if (!token) return <Navigate to="/admin/login" replace />
  return children
}