// frontend/src/api.ts
// Simple wrapper for older imports. Prefer using services/api.ts going forward.

const RAW: string = (import.meta as any).env?.VITE_API_BASE_URL || ''
const BASE_URL: string = RAW.replace(/\/+$/, '')

function token() {
  return typeof window !== 'undefined' ? sessionStorage.getItem('accessToken') : null
}
function authHeader(): Record<string, string> {
  const t = token()
  return t ? { Authorization: 'Bearer ' + t } : {}
}
async function req<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE_URL + path, {
    headers: { 'Content-Type': 'application/json', ...authHeader(), ...(init?.headers || {}) },
    ...(init || {}),
  })
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json()
}

// Legacy exports
export async function getAnimals() {
  return req('/api/animals')
}

export async function getAdoptionMe(): Promise<{
  ok: boolean
  user: { id: string; email: string; role: string }
  access: Record<string, boolean>
}> {
  return req('/api/adoption/me')
}