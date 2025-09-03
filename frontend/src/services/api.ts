// frontend/src/services/api.ts
// Centralized API helpers — NO template literals in URLs.
// Works with VITE_API_BASE_URL (set in DO Frontend → Environment Variables).

/* =========================
   Base & helpers
   ========================= */

const RAW: string = (import.meta as any).env?.VITE_API_BASE_URL || ''
const BASE_URL: string = RAW.replace(/\/+$/, '')

if (!BASE_URL) {
  // eslint-disable-next-line no-console
  console.warn('VITE_API_BASE_URL is not defined. Set it in DO Frontend → Environment Variables.')
}

function getToken(): string | null {
  return typeof window !== 'undefined' ? sessionStorage.getItem('accessToken') : null
}

function setToken(token: string): void {
  sessionStorage.setItem('accessToken', token)
}

export function logout(): void {
  sessionStorage.removeItem('accessToken')
}

function authHeader(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: 'Bearer ' + token } : {}
}

async function req<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE_URL + path, {
    headers: Object.assign(
      { 'Content-Type': 'application/json' },
      authHeader(),
      init && init.headers ? init.headers : {}
    ),
    ...(init || {}),
  })
  if (!res.ok) {
    let text = ''
    try { text = await res.text() } catch {}
    throw new Error(String(res.status) + ' ' + res.statusText + ' for ' + path + ' → ' + text)
  }
  // Some endpoints (e.g., DELETE) may respond with empty body
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('application/json')) {
    // @ts-expect-error: allow returning void/unknown
    return undefined
  }
  return res.json() as Promise<T>
}

/* =========================
   Types
   ========================= */

export type GalerieMedia = { id?: string; url: string; typ?: 'image' | 'video' }

export type Animal = {
  id: string
  name?: string
  jmeno?: string
  description?: string
  popis?: string
  galerie?: GalerieMedia[]
  active?: boolean
}

export type LoginResponse = { token: string; role?: 'ADMIN' | 'MODERATOR' | 'USER' }

/* =========================
   Auth (unified backend endpoint)
   ========================= */

async function login(email: string, password: string): Promise<LoginResponse> {
  const data = await req<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: email, password: password }),
  })
  if (!data || !data.token) throw new Error('Login failed: token missing')
  setToken(data.token)
  return data
}

// Aliases for clarity in pages:
export async function loginAdmin(email: string, password: string) {
  return login(email, password) // backend may return role; UI can check if needed
}
export async function loginModerator(email: string, password: string) {
  return login(email, password)
}

/* =========================
   Animals (public + protected)
   ========================= */

export async function fetchAnimals(): Promise<Animal[]> {
  return req<Animal[]>('/api/animals')
}

export async function fetchAnimal(id: string): Promise<Animal> {
  if (!id) throw new Error('fetchAnimal: id is required')
  return req<Animal>('/api/animals/' + encodeURIComponent(id))
}

export async function createAnimal(payload: Partial<Animal>): Promise<Animal> {
  return req<Animal>('/api/animals', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateAnimal(id: string, payload: Partial<Animal>): Promise<Animal> {
  if (!id) throw new Error('updateAnimal: id is required')
  return req<Animal>('/api/animals/' + encodeURIComponent(id), {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteAnimal(id: string): Promise<{ ok: true }> {
  if (!id) throw new Error('deleteAnimal: id is required')
  return req<{ ok: true }>('/api/animals/' + encodeURIComponent(id), { method: 'DELETE' })
}

/* =========================
   Upload (multipart)
   ========================= */

export async function uploadMedia(file: File): Promise<{ url: string }> {
  const form = new FormData()
  form.append('file', file)

  const token = getToken()
  const headers: Record<string, string> = token ? { Authorization: 'Bearer ' + token } : {}

  const res = await fetch(BASE_URL + '/api/upload', {
    method: 'POST',
    headers: headers, // no Content-Type; browser sets multipart boundary
    body: form,
  })
  if (!res.ok) throw new Error('Upload failed: ' + res.status)
  return res.json()
}

/* =========================
   Admin utilities (example)
   ========================= */

export async function listModerators(): Promise<Array<{ id: string; email: string; role: string; active?: boolean }>> {
  return req<Array<{ id: string; email: string; role: string; active?: boolean }>>('/api/admin/moderators')
}

// === Moderators (admin) ===
export async function listModerators() {
  return req<Array<{ id: string; email: string; role: string; active?: boolean }>>('/api/admin/moderators')
}

export async function createModerator(email: string, password: string) {
  return req<{ id: string; email: string; role: string }>('/api/admin/moderators', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  })
}

export async function deleteModerator(id: string) {
  return req<{ ok: true }>('/api/admin/moderators/' + encodeURIComponent(id), {
    method: 'DELETE'
  })
}

export async function resetModeratorPassword(id: string, password: string) {
  return req<{ ok: true }>('/api/admin/moderators/' + encodeURIComponent(id) + '/password', {
    method: 'PATCH',
    body: JSON.stringify({ password })
  })
}

/* =========================
   Session helpers (optional)
   ========================= */

export function isAuthenticated(): boolean {
  return !!getToken()
}