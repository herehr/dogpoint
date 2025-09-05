import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type AccessMap = Record<string /* animalId */, boolean>

type AccessCtx = {
  hasAccess: (animalId: string) => boolean
  grantAccess: (animalId: string) => void
  resetAccess: (animalId?: string) => void
  snapshot: AccessMap
}

const AccessContext = createContext<AccessCtx | undefined>(undefined)
const LS_KEY = 'adoptionAccessMap'

export function AccessProvider({ children }: { children: React.ReactNode }) {
  const [map, setMap] = useState<AccessMap>({})

  // hydrate from localStorage (cache). Source of truth still backend.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) setMap(JSON.parse(raw))
    } catch {}
  }, [])

  // persist
  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(map)) } catch {}
  }, [map])

  const value = useMemo<AccessCtx>(() => ({
    snapshot: map,
    hasAccess: (id) => !!map[id],
    grantAccess: (id) => setMap(m => ({ ...m, [id]: true })),
    resetAccess: (id) => {
      if (!id) { setMap({}); return }
      setMap(m => {
        const next = { ...m }
        delete next[id]
        return next
      })
    }
  }), [map])

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>
}

export function useAccess(): AccessCtx {
  const ctx = useContext(AccessContext)
  if (!ctx) throw new Error('useAccess must be used inside <AccessProvider>')
  return ctx
}