// frontend/src/context/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { clearToken, getToken, me } from '../services/api'

export type Role = 'ADMIN' | 'MODERATOR' | 'USER' | null

export type AuthUser = {
  id: string
  email: string
  role: Role
}

type AuthCtx = {
  token: string | null
  role: Role
  user: AuthUser | null
  login: (token: string, role: Role) => Promise<void>
  logout: () => void
  refreshMe: () => Promise<void>
}

const Ctx = createContext<AuthCtx>({
  token: null,
  role: null,
  user: null,
  login: async () => {},
  logout: () => {},
  refreshMe: async () => {},
})

const ROLE_KEY = 'role'

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Provider                                                           */
/* ------------------------------------------------------------------ */

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Token is owned by services/api.ts storage logic
  const [token, setToken] = useState<string | null>(() => getToken())
  const [role, setRole] = useState<Role>(() => safeGetRole())
  const [user, setUser] = useState<AuthUser | null>(null)

  /* -------------------------------------------------------------- */
  /* Load current user from backend                                 */
  /* -------------------------------------------------------------- */
  const refreshMe = async () => {
    const t = getToken()
    if (!t) {
      setUser(null)
      setRole(null)
      return
    }

    try {
      const u = await me()
      setUser({
        id: u.id,
        email: u.email,
        role: u.role,
      })
      setRole(u.role)
      safeSetRole(u.role)
    } catch (e) {
      console.warn('[AuthContext] me() failed → logout', e)
      logout()
    }
  }

  /* -------------------------------------------------------------- */
  /* Initial load + multi-tab sync                                   */
  /* -------------------------------------------------------------- */
  useEffect(() => {
    refreshMe()

    const onStorage = () => {
      setToken(getToken())
      setRole(safeGetRole())
      refreshMe()
    }

    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  /* -------------------------------------------------------------- */
  /* Login / Logout                                                   */
  /* -------------------------------------------------------------- */
  const login = async (jwt: string, r: Role) => {
    setToken(jwt)
    setRole(r)
    safeSetRole(r)
    await refreshMe()
  }

  const logout = () => {
    setToken(null)
    setRole(null)
    setUser(null)
    safeSetRole(null)

    // Clears accessToken + adminToken + moderatorToken + legacy keys
    clearToken()

    // App-specific cache
    try {
      localStorage.removeItem('dogpoint.access')
    } catch {}
  }

  const value = useMemo(
    () => ({
      token,
      role,
      user,
      login,
      logout,
      refreshMe,
    }),
    [token, role, user],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/* ------------------------------------------------------------------ */
/* Hook                                                               */
/* ------------------------------------------------------------------ */

export function useAuth() {
  return useContext(Ctx)
}