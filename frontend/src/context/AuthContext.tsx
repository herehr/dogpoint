// frontend/src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { clearToken, getToken } from '../services/api'

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

const ROLE_KEY = 'role'

function safeGetRole(): Role {
  try {
    const v = localStorage.getItem(ROLE_KEY)
    if (v) return v as Role
  } catch {}
  try {
    const v = sessionStorage.getItem(ROLE_KEY)
    if (v) return v as Role
  } catch {}
  return null
}

function safeSetRole(role: Role) {
  try {
    if (role) localStorage.setItem(ROLE_KEY, role)
    else localStorage.removeItem(ROLE_KEY)
  } catch {}
  try {
    if (role) sessionStorage.setItem(ROLE_KEY, role)
    else sessionStorage.removeItem(ROLE_KEY)
  } catch {}
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // ✅ token is owned by services/api.ts storage logic
  const [token, setToken] = useState<string | null>(() => getToken())
  const [role, setRole] = useState<Role>(() => safeGetRole())

  // ✅ keep state updated if storage changes (multi-tab etc.)
  useEffect(() => {
    const onStorage = () => {
      setToken(getToken())
      setRole(safeGetRole())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const login = (jwt: string, r: Role) => {
    // Token is stored by whichever login flow you call (setToken / setAdminToken / setModeratorToken).
    // Here we only update UI state.
    setToken(jwt || null)
    setRole(r || null)
    safeSetRole(r || null)
  }

  const logout = () => {
    setToken(null)
    setRole(null)
    safeSetRole(null)

    // ✅ clears accessToken + adminToken + moderatorToken + legacy keys (local+session)
    clearToken()

    // app-specific cached access
    try {
      localStorage.removeItem('dogpoint.access')
    } catch {}
  }

  const value = useMemo(() => ({ token, role, login, logout }), [token, role])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  return useContext(Ctx)
}