import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

type Role = 'ADMIN' | 'MODERATOR' | 'USER'
type AuthState = {
  token: string | null
  role: Role | null
}

type AuthContextType = AuthState & {
  login: (token: string, role?: Role | null) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null)
  const [role, setRole] = useState<Role | null>(null)

  // Hydrate ONCE on app start from sessionStorage
  useEffect(() => {
    const t = sessionStorage.getItem('accessToken')
    const r = sessionStorage.getItem('role') as Role | null
    if (t) setToken(t)
    if (r) setRole(r)
  }, [])

  const login = (t: string, r?: Role | null) => {
    setToken(t)
    if (t) sessionStorage.setItem('accessToken', t)
    if (r) {
      setRole(r)
      sessionStorage.setItem('role', r)
    }
  }

  const logout = () => {
    setToken(null)
    setRole(null)
    sessionStorage.removeItem('accessToken')
    sessionStorage.removeItem('role')
  }

  const value = useMemo<AuthContextType>(() => ({ token, role, login, logout }), [token, role])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}