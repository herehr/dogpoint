// frontend/src/context/AccessContext.tsx
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState
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

const LS_KEY = 'adoption_access_v1'

// ---- storage helpers (use localStorage for iOS Safari reliability) ----
function readFromStorage(): AccessMap {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}
function writeToStorage(map: AccessMap) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(map)) } catch {}
}

export function AccessProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth()
  const [map, setMap] = useState<AccessMap>(() => readFromStorage())

  // Persist any local changes
  useEffect(() => { writeToStorage(map) }, [map])

  // Merge with server truth once we have a token (after login / adoption)
  useEffect(() => {
    let alive = true
    if (!token) return
    getAdoptionMe()
      .then(res => {
        if (!alive || !res?.access) return
        setMap(prev => {
          const merged: AccessMap = { ...prev, ...res.access }
          writeToStorage(merged)
          return merged
        })
      })
      .catch(() => { /* silent – offline or endpoint not ready */ })
    return () => { alive = false }
  }, [token])

  const hasAccess = useCallback((animalId: string) => !!map[animalId], [map])

  // Optimistic unlock (used after successful adoption)
  const grantAccess = useCallback((animalId: string) => {
    setMap(prev => {
      if (prev[animalId]) return prev
      const next = { ...prev, [animalId]: true }
      writeToStorage(next)
      return next
    })
  }, [])

  // Remove one unlock or clear all
  const resetAccess = useCallback((animalId?: string) => {
    setMap(prev => {
      if (!animalId) {
        writeToStorage({})
        return {}
      }
      if (!prev[animalId]) return prev
      const copy = { ...prev }
      delete copy[animalId]
      writeToStorage(copy)
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