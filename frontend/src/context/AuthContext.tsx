// frontend/src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { loginAdmin as apiLogin } from '../services/api'

// Types
type Role = 'ADMIN' | 'MODERATOR' | 'USER'
type AuthState = { token: string | null; role: Role | null; email?: string | null }
type AuthCtx = {
  token: string | null
  role: Role | null
  login: (email: string, password: string) => Promise<{ token: string; role: Role }>
  logout: () => void
}

const AuthContext = createContext<AuthCtx>({
  token: null, role: null,
  login: async () => ({ token: '', role: 'USER' }),
  logout: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('accessToken'))
  const [role, setRole] = useState<Role | null>(() => (sessionStorage.getItem('role') as Role | null) || null)

  // Inactivity auto-logout in 10 minutes
  const IDLE_MS = 10 * 60 * 1000
  const idleTimer = useRef<number | null>(null)

  function bumpIdleTimer() {
    if (idleTimer.current) window.clearTimeout(idleTimer.current)
    if (token) {
      idleTimer.current = window.setTimeout(() => {
        // auto logout
        logout()
      }, IDLE_MS)
    }
  }

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart']
    const handler = () => bumpIdleTimer()
    events.forEach(ev => window.addEventListener(ev, handler, { passive: true }))
    bumpIdleTimer()
    return () => {
      events.forEach(ev => window.removeEventListener(ev, handler))
      if (idleTimer.current) window.clearTimeout(idleTimer.current)
    }
  }, [token])

  async function login(email: string, password: string) {
    const res = await apiLogin(email, password) // unified /api/auth/login
    sessionStorage.setItem('accessToken', res.token)
    sessionStorage.setItem('role', res.role || 'USER')
    setToken(res.token)
    setRole((res.role || 'USER') as Role)
    bumpIdleTimer()
    return { token: res.token, role: (res.role || 'USER') as Role }
  }

  function logout() {
    sessionStorage.removeItem('accessToken')
    sessionStorage.removeItem('role')
    setToken(null)
    setRole(null)
    window.location.assign('/') // back to landing
  }

  return (
    <AuthContext.Provider value={{ token, role, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}