import React, { createContext, useContext, useEffect, useState } from 'react'

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [role, setRole] = useState<Role>(null)

  // ✅ hydrate from sessionStorage
  useEffect(() => {
    const t = sessionStorage.getItem('accessToken')
    const r = sessionStorage.getItem('role') as Role
    setToken(t)
    setRole(r ?? null)
  }, [])

  const login = (t: string, r: Role) => {
    sessionStorage.setItem('accessToken', t)
    if (r) sessionStorage.setItem('role', r)
    setToken(t)
    setRole(r ?? null)
  }

  const logout = () => {
    sessionStorage.removeItem('accessToken')
    sessionStorage.removeItem('role')
    setToken(null)
    setRole(null)
  }

  return (
    <Ctx.Provider value={{ token, role, login, logout }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth() {
  return useContext(Ctx)
}