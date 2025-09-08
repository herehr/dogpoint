// frontend/src/context/AccessContext.tsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

// Small local cache so refresh keeps access; swap to server if you prefer
type AccessMap = Record<string, boolean>

type AccessContextShape = {
  hasAccess: (animalId: string) => boolean
  grantAccess: (animalId: string) => void
  resetAccess: (animalId?: string) => void
}

const AccessContext = createContext<AccessContextShape | null>(null)

function readFromStorage(): AccessMap {
  try {
    const raw = sessionStorage.getItem('access.map')
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}
function writeToStorage(map: AccessMap) {
  try { sessionStorage.setItem('access.map', JSON.stringify(map)) } catch {}
}

export function AccessProvider({ children }: { children: React.ReactNode }) {
  const [map, setMap] = useState<AccessMap>(() => readFromStorage())

  useEffect(() => { writeToStorage(map) }, [map])

  const hasAccess = useCallback((animalId: string) => !!map[animalId], [map])

  const grantAccess = useCallback((animalId: string) => {
    setMap(prev => ({ ...prev, [animalId]: true }))
  }, [])

  const resetAccess = useCallback((animalId?: string) => {
    setMap(prev => {
      if (!animalId) return {}
      const copy = { ...prev }; delete copy[animalId]; return copy
    })
  }, [])

  const value = useMemo(() => ({ hasAccess, grantAccess, resetAccess }), [hasAccess, grantAccess, resetAccess])
  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>
}

export function useAccess() {
  const ctx = useContext(AccessContext)
  if (!ctx) throw new Error('useAccess must be used within <AccessProvider>')
  return ctx
}