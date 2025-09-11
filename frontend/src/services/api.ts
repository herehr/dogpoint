// frontend/src/services/api.ts
// Centralized API helpers — SPA-friendly, typed, resilient.
// Uses VITE_API_BASE_URL (set in DO Frontend → Environment Variables).

import type { Animal, Post } from '../types/models'

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

// Core JSON request helper (tolerates non-JSON responses)
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

  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('application/json')) {
    // @ts-expect-error allow void return for non-JSON endpoints
    return undefined
  }
  return res.json() as Promise<T>
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  if (!entries.length) return ''
  const s = new URLSearchParams(entries as Array<[string, string]>)
  return '?' + s.toString()
}

/* =========================
   Auth (unified backend endpoint)
   ========================= */

export type LoginResponse = { token: string; role?: 'ADMIN' | 'MODERATOR' | 'USER' }

// ⬇️ make sure this is a **named export**
export async function login(email: string, password: string): Promise<LoginResponse> {
  const data = await req<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  if (!data || !data.token) throw new Error('Login failed: token missing')
  setToken(data.token)
  return data
}

// Optional thin wrappers (safe to keep or delete)
export async function loginAdmin(email: string, password: string) {
  return login(email, password)
}
export async function loginModerator(email: string, password: string) {
  return login(email, password)
}

/* =========================
   Animals
   ========================= */

// Normalize any backend variants (galerie/gallery, main fallback, legacy names)
function normalizeAnimal(a: any): Animal {
  const galerie = Array.isArray(a?.galerie)
    ? a.galerie
    : Array.isArray(a?.gallery)
    ? a.gallery
    : []
  const main = a?.main || galerie?.[0]?.url || '/no-image.jpg'

  return {
    id: String(a?.id ?? ''),
    jmeno: a?.jmeno ?? a?.name ?? '',
    druh: a?.druh,           // 'pes' | 'kočka' | 'jiné' | undefined
    vek: a?.vek,             // string | undefined
    popis: a?.popis ?? a?.description ?? '',
    main,
    galerie,
    active: a?.active ?? true,
  } as Animal
}

export async function fetchAnimals(): Promise<Animal[]> {
  const list = await req<any[]>('/api/animals')
  return (list || []).map(normalizeAnimal)
}

export async function fetchAnimal(id: string): Promise<Animal> {
  if (!id) throw new Error('fetchAnimal: id is required')
  const a = await req<any>('/api/animals/' + encodeURIComponent(id))
  return normalizeAnimal(a)
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

// User’s adopted animals with hasNew flag
export async function myAdoptedAnimals(): Promise<Array<{
  animal: { id: string; jmeno: string; main: string | null; active: boolean }
  monthly: number | null
  hasNew: boolean
  latestAt: string
  lastSeenAt: string | null
}>> {
  return req('/api/adoption/my-animals')
}

export async function markAnimalSeen(animalId: string) {
  return req('/api/adoption/seen', {
    method: 'POST',
    body: JSON.stringify({ animalId }),
  })
}

export async function endAdoption(animalId: string) {
  return req('/api/adoption/end', {
    method: 'POST',
    body: JSON.stringify({ animalId }),
  })
}

/* =========================
   Upload (multipart)
   ========================= */

// Do NOT set Content-Type; browser sets multipart boundary automatically.
export async function uploadMedia(file: File): Promise<{ url: string }> {
  const form = new FormData()
  form.append('file', file)

  const token = getToken()
  const headers: Record<string, string> = token ? { Authorization: 'Bearer ' + token } : {}

  const res = await fetch(BASE_URL + '/api/upload', {
    method: 'POST',
    headers, // leave Content-Type unset
    body: form,
  })
  if (!res.ok) {
    let text = ''
    try { text = await res.text() } catch {}
    throw new Error('Upload failed: ' + res.status + (text ? ` → ${text}` : ''))
  }
  return res.json()
}

// Batch upload with progress callback
export async function uploadMediaMany(
  files: File[],
  onProgress?: (index: number, total: number) => void
): Promise<string[]> {
  const urls: string[] = []
  for (let i = 0; i < files.length; i++) {
    onProgress?.(i, files.length)
    const { url } = await uploadMedia(files[i])
    urls.push(url)
  }
  return urls
}

/* =========================
   Adoption access
   ========================= */

// GET /api/adoption/access/:animalId → { access: boolean }
export async function hasAccessForAnimal(animalId: string): Promise<{ access: boolean }> {
  if (!animalId) throw new Error('hasAccessForAnimal: animalId is required')
  return req<{ access: boolean }>('/api/adoption/access/' + encodeURIComponent(animalId))
}
export async function getAdoptionMe(): Promise<{ ok: boolean; user: { id: string; email: string; role: string }, access: Record<string, boolean> }> {
  return req('/api/adoption/me')
}

// POST /api/adoption/start  → now email can be omitted if user is already logged in
export async function startAdoption(
  animalId: string,
  email?: string,
  name?: string,
  monthly?: number
) {
  if (!animalId) throw new Error('startAdoption: animalId is required')
  const haveToken = !!getToken()
  if (!haveToken && !email) throw new Error('startAdoption: email is required')

  const res = await fetch(BASE_URL + '/api/adoption/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ animalId, email, name, monthly }),
  })
  const text = await res.text()
  if (!res.ok) {
    let msg = 'startAdoption failed'
    try { const j = JSON.parse(text); msg = j?.error || msg } catch {}
    throw new Error(msg)
  }
  const data = text ? JSON.parse(text) : {}
  if (data?.token) setToken(data.token)
  return data as { ok: boolean; token?: string; access?: Record<string, boolean>; userHasPassword?: boolean }
}


/* =========================
   Posts (public & adopter stories)
   ========================= */

export async function listPostsPublic(params?: { animalId?: string }): Promise<Post[]> {
  const query = qs({ animalId: params?.animalId })
  try {
    return await req<Post[]>('/api/posts' + query)
  } catch (e: any) {
    // If backend doesn't have /api/posts yet (404), show empty list gracefully.
    if (String(e.message || '').includes('404')) return []
    return []
  }
}

// Secured create (token required)
export async function createPost(payload: Partial<Post> & { animalId?: string }) {
  return req<Post>('/api/posts', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/* =========================
   Admin → Moderators
   ========================= */

export async function listModerators() {
  return req<Array<{ id: string; email: string; role: string; active?: boolean }>>(
    '/api/admin/moderators'
  )
}

export async function createModerator(email: string, password: string) {
  return req<{ id: string; email: string; role: string }>('/api/admin/moderators', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function deleteModerator(id: string) {
  return req<{ ok: true }>('/api/admin/moderators/' + encodeURIComponent(id), {
    method: 'DELETE',
  })
}

export async function resetModeratorPassword(id: string, password: string) {
  return req<{ ok: true }>(
    '/api/admin/moderators/' + encodeURIComponent(id) + '/password',
    {
      method: 'PATCH',
      body: JSON.stringify({ password }),
    }
  )
}

// Add near other auth helpers
export async function setPasswordFirstTime(email: string, password: string) {
  const data = await req<{ token: string; role?: 'ADMIN' | 'MODERATOR' | 'USER' }>(
    '/api/auth/set-password-first-time',
    { method: 'POST', body: JSON.stringify({ email, password }) }
  )
  if (!data?.token) throw new Error('PASSWORD_SET_FAILED')
  sessionStorage.setItem('accessToken', data.token)
  return data
}

/* =========================
   Session helpers
   ========================= */

export function isAuthenticated(): boolean {
  return !!getToken()
}