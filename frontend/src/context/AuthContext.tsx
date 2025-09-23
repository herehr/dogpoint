import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

type Role = 'ADMIN' | 'MODERATOR' | 'USER' | null

type AuthCtx = {
  token: string | null
  role: Role
  login: (token: string, role: Role) => void
  logout: () => void
}

const Ctx = createContext<AuthCtx>({
  token: null,
  role: null,
  login: () => {},
  logout: () => {},
})

const TOKEN_KEY = 'accessToken'
const ROLE_KEY = 'role'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    try { return sessionStorage.getItem(TOKEN_KEY) } catch { return null }
  })
  const [role, setRole] = useState<Role>(() => {
    try { return (sessionStorage.getItem(ROLE_KEY) as Role) || null } catch { return null }
  })

  // Keep sessionStorage in sync if state changes in runtime
  useEffect(() => {
    try {
      if (token) sessionStorage.setItem(TOKEN_KEY, token)
      else sessionStorage.removeItem(TOKEN_KEY)
    } catch {}
  }, [token])

  useEffect(() => {
    try {
      if (role) sessionStorage.setItem(ROLE_KEY, role)
      else sessionStorage.removeItem(ROLE_KEY)
    } catch {}
  }, [role])

  // Public API
  const login = (jwt: string, r: Role) => {
    setToken(jwt || null)
    setRole(r || null)
    try {
      if (jwt) sessionStorage.setItem(TOKEN_KEY, jwt)
      else sessionStorage.removeItem(TOKEN_KEY)
      if (r) sessionStorage.setItem(ROLE_KEY, r)
      else sessionStorage.removeItem(ROLE_KEY)
    } catch {}
  }

  const logout = () => {
    setToken(null)
    setRole(null)
    try {
      sessionStorage.removeItem(TOKEN_KEY)
      sessionStorage.removeItem(ROLE_KEY)
    } catch {}
    // If you cache per-user access elsewhere, clear it here (e.g., localStorage keys).
    try { localStorage.removeItem('dogpoint.access') } catch {}
  }

  const value = useMemo(() => ({ token, role, login, logout }), [token, role])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  return useContext(Ctx)
}