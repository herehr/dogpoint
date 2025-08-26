import React from 'react'
import { Navigate } from 'react-router-dom'
import { getToken } from './authService'

interface RequireRoleProps {
  children: JSX.Element
  requiredRole: 'ADMIN' | 'MODERATOR' | 'USER'
}

export const RequireRole: React.FC<RequireRoleProps> = ({ children, requiredRole }) => {
  const token = getToken()
  if (!token) return <Navigate to="/moderator/login" replace />

  const payload = JSON.parse(atob(token.split('.')[1]))
  if (payload.role !== requiredRole) return <Navigate to="/" replace />

  return children
}