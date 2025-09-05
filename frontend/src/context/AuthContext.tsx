import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

type Role = 'ADMIN' | 'MODERATOR' | 'USER' | null

type AuthState = {
  token: string | null
  role: Role
  userEmail: string | null
}

type AuthCtx = AuthState & {
  login: (token: string, role?: Role, userEmail?: string | null) => void
  logout: () => void
}

const AuthContext = createContext<AuthCtx | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [role, setRole] = useState<Role>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  // hydrate from sessionStorage on first load
  useEffect(() => {
    try {
      const t = sessionStorage.getItem('accessToken')
      const r = sessionStorage.getItem('role') as Role | null
      const e = sessionStorage.getItem('userEmail')
      if (t) setToken(t)
      if (r) setRole(r)
      if (e) setUserEmail(e)
    } catch {}
  }, [])

  const value = useMemo<AuthCtx>(() => ({
    token,
    role,
    userEmail,
    login: (t, r = null, e = null) => {
      setToken(t)
      setRole(r ?? null)
      setUserEmail(e ?? null)
      try {
        sessionStorage.setItem('accessToken', t)
        if (r) sessionStorage.setItem('role', r)
        else sessionStorage.removeItem('role')
        if (e) sessionStorage.setItem('userEmail', e)
        else sessionStorage.removeItem('userEmail')
      } catch {}
    },
    logout: () => {
      setToken(null)
      setRole(null)
      setUserEmail(null)
      try {
        sessionStorage.removeItem('accessToken')
        sessionStorage.removeItem('role')
        sessionStorage.removeItem('userEmail')
      } catch {}
    }
  }), [token, role, userEmail])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}