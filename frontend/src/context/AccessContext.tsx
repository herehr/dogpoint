// frontend/src/context/AccessContext.tsx
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState
} from 'react'
import { useAuth } from './AuthContext'
import { getAdoptionMe } from '../services/api'

// Local cache of unlocked animal IDs
type AccessMap = Record<string, boolean>

type AccessContextShape = {
  hasAccess: (animalId: string) => boolean
  grantAccess: (animalId: string) => void
  resetAccess: (animalId?: string) => void
}

const AccessContext = createContext<AccessContextShape | null>(null)

// Storage key is namespaced by userId to prevent cross-user leakage
const BASE_KEY = 'adoption_access_v1'
const keyFor = (userId?: string | null) => (userId ? `${BASE_KEY}:${userId}` : BASE_KEY)

// ---- storage helpers (localStorage for iOS Safari reliability) ----
function readFromStorage(storageKey: string): AccessMap {
  try {
    const raw = localStorage.getItem(storageKey)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}
function writeToStorage(storageKey: string, map: AccessMap) {
  try { localStorage.setItem(storageKey, JSON.stringify(map)) } catch {}
}
function clearStorage(storageKey: string) {
  try { localStorage.removeItem(storageKey) } catch {}
}

export function AccessProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth()
  const [map, setMap] = useState<AccessMap>({})
  const [userId, setUserId] = useState<string | null>(null)

  // Keep a ref of the current storage key for easy writes
  const storageKeyRef = useRef<string>(keyFor(null))

  // When token changes:
  // - if no token → clear in-memory and local storage for previous user
  // - if token exists → fetch /me, load server access, and use userId-namespaced storage
  useEffect(() => {
    let alive = true

    async function sync() {
      if (!token) {
        // Logged out → drop everything
        const prevKey = storageKeyRef.current
        setUserId(null)
        setMap({})
        clearStorage(prevKey) // ensure no stale access stays around
        return
      }

      try {
        const res = await getAdoptionMe() // { ok, user, access }
        if (!alive) return

        const uid = res?.user?.id ? String(res.user.id) : null
        setUserId(uid)

        const skey = keyFor(uid)
        storageKeyRef.current = skey

        // Merge server truth with any local draft (rare)
        const local = readFromStorage(skey)
        const merged: AccessMap = { ...local, ...(res?.access || {}) }
        setMap(merged)
        writeToStorage(skey, merged)
      } catch {
        // Silent: backend might be down; keep current map (likely empty on first load)
      }
    }

    sync()
    return () => { alive = false }
  }, [token])

  // Persist any local changes for the current user
  useEffect(() => {
    writeToStorage(storageKeyRef.current, map)
  }, [map])

  const hasAccess = useCallback((animalId: string) => !!map[animalId], [map])

  // Optimistic unlock (used after successful adoption)
  const grantAccess = useCallback((animalId: string) => {
    setMap(prev => {
      if (prev[animalId]) return prev
      const next = { ...prev, [animalId]: true }
      writeToStorage(storageKeyRef.current, next)
      return next
    })
  }, [])

  // Remove one unlock or clear all for current user
  const resetAccess = useCallback((animalId?: string) => {
    setMap(prev => {
      if (!animalId) {
        clearStorage(storageKeyRef.current)
        return {}
      }
      if (!prev[animalId]) return prev
      const copy = { ...prev }
      delete copy[animalId]
      writeToStorage(storageKeyRef.current, copy)
      return copy
    })
  }, [])

  const value = useMemo(
    () => ({ hasAccess, grantAccess, resetAccess }),
    [hasAccess, grantAccess, resetAccess]
  )

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>
}

export function useAccess() {
  const ctx = useContext(AccessContext)
  if (!ctx) throw new Error('useAccess must be used within <AccessProvider>')
  return ctx
}