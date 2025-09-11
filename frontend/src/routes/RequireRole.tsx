import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function RequireRole({
  roles,
  children,
}: {
  roles: Array<'ADMIN' | 'MODERATOR' | 'USER'>
  children: React.ReactNode
}) {
  const { token, role } = useAuth()
  const location = useLocation()

  if (!token) {
    // not logged in → go to login
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // strict check
  if (role && roles.includes(role)) {
    return <>{children}</>
  }

  // optional permissive fallback for adopters with token but no role persisted
  if (!role && roles.includes('USER')) {
    return <>{children}</>
  }

  // logged in but wrong role → send to their dashboard
  const target =
    role === 'ADMIN' ? '/admin' :
    role === 'MODERATOR' ? '/moderator' :
    '/user'

  return <Navigate to={target} replace />
}

  return <Outlet />
}