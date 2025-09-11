import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

type Role = 'ADMIN' | 'MODERATOR' | 'USER' | null
type AuthState = {
  token: string | null
  role: Role
  email?: string | null
}
type AuthContextValue = AuthState & {
  loginWithToken: (token: string, role?: Role, email?: string) => void
  logout: () => void
}
const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [role, setRole] = useState<Role>(null)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    const t = sessionStorage.getItem('accessToken')
    const r = sessionStorage.getItem('role') as Role | null
    const e = sessionStorage.getItem('email')
    if (t) setToken(t)
    if (r) setRole(r)
    if (e) setEmail(e)
  }, [])

  const loginWithToken = (t: string, r?: Role, e?: string) => {
    setToken(t)
    sessionStorage.setItem('accessToken', t)
    if (r) {
      setRole(r)
      sessionStorage.setItem('role', r)
    }
    if (e) {
      setEmail(e)
      sessionStorage.setItem('email', e)
    }
  }

  const logout = () => {
    setToken(null)
    setRole(null)
    setEmail(null)
    sessionStorage.removeItem('accessToken')
    sessionStorage.removeItem('role')
    sessionStorage.removeItem('email')
  }

  const value = useMemo(() => ({ token, role, email, loginWithToken, logout }), [token, role, email])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}