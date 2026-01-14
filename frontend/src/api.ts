// frontend/src/api.ts
// Public API layer for the frontend.
// IMPORTANT: Do NOT include '/api' in VITE_API_BASE_URL.
//   dev:  VITE_API_BASE_URL=http://localhost:3000
//   prod: VITE_API_BASE_URL=https://dp-backend-3vysi.ondigitalocean.tld

import {
  apiUrl,
  getJSON,
  // ✅ use the new persistent token system from services/api.ts
  getToken,
  authHeader as authHeaderSvc,
  setToken,
  setAdminToken,
  setModeratorToken,
} from './services/api'

export { getJSON, apiUrl }

// ✅ re-export one single authHeader used everywhere
export function authHeader(): Record<string, string> {
  return authHeaderSvc()
}

// ---- Types (light) ----
export type GalerieMedia = {
  id?: string
  url?: string
  key?: string
  type?: 'image' | 'video'
  active?: boolean
}

export type Animal = {
  id: string
  name?: string
  jmeno?: string
  description?: string
  popis?: string
  druh?: string
  vek?: string
  galerie?: GalerieMedia[]
  active?: boolean
}

export type Moderator = {
  id: string
  email: string
  role: 'MODERATOR' | 'ADMIN'
  active?: boolean
}

export type PostPublic = {
  id: string
  animalId?: string
  title?: string
  text?: string
  createdAt?: string
  media?: GalerieMedia[]
  active?: boolean
}

// Used by UserDashboard
export type MyAdoptedItem = {
  animalId: string
  title?: string
  jmeno?: string
  name?: string
  main?: string
  status?: string
  since?: string
}

// ---- Animals (list/detail + CRUD) ----
export async function getAnimals(params?: { limit?: number; active?: boolean }) {
  const q = new URLSearchParams()
  if (params?.limit) q.set('limit', String(params.limit))
  if (typeof params?.active === 'boolean') q.set('active', String(params.active))
  const qs = q.toString() ? `?${q.toString()}` : ''
  return getJSON<Animal[]>(`/api/animals${qs}`)
}

export async function getAnimalsTeasers() {
  return getAnimals({ limit: 3, active: true })
}

export async function getAnimal(id: string) {
  return getJSON<Animal>(`/api/animals/${encodeURIComponent(id)}`)
}

// legacy shims for older imports
export async function fetchAnimals() {
  return getAnimals()
}
export async function fetchAnimal(id: string) {
  return getAnimal(id)
}

export async function createAnimal(payload: Partial<Animal>) {
  const res = await fetch(apiUrl('/api/animals'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${(await res.text().catch(() => '')) || res.statusText}`)
  }
  return res.json()
}

export async function updateAnimal(id: string, payload: Partial<Animal>) {
  const res = await fetch(apiUrl(`/api/animals/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${(await res.text().catch(() => '')) || res.statusText}`)
  }
  return res.json()
}

export async function deleteAnimal(id: string) {
  const res = await fetch(apiUrl(`/api/animals/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    headers: { ...authHeader() },
  })
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${(await res.text().catch(() => '')) || res.statusText}`)
  }
  return res.json()
}

// ---- Adoption/Auth ----

/** Username+password login — returns { token, role } */
export async function login(
  email: string,
  password: string,
): Promise<{ token: string; role?: 'ADMIN' | 'MODERATOR' | 'USER' }> {
  const res = await fetch(apiUrl('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text || res.statusText}`)
  }
  return res.json()
}

/**
 * ✅ Unified ADMIN login
 * - store token persistently
 * - IMPORTANT: store as admin token so admin pages always send the correct JWT
 */
export async function loginAdmin(
  email: string,
  password: string,
): Promise<{ token: string; role?: 'ADMIN' | 'MODERATOR' | 'USER' }> {
  const data = await login(email, password)

  // persist
  if (data?.token) {
    setAdminToken(data.token)
  }

  return data
}

/**
 * ✅ OPTIONAL: Moderator login helper (if you use a dedicated moderator login page)
 * If your backend uses the same /api/auth/login, this is just an alias.
 */
export async function loginModerator(
  email: string,
  password: string,
): Promise<{ token: string; role?: 'ADMIN' | 'MODERATOR' | 'USER' }> {
  const data = await login(email, password)
  if (data?.token) setModeratorToken(data.token)
  return data
}

export async function setPasswordFirstTime(email: string, password: string) {
  const res = await fetch(apiUrl('/api/auth/set-password-first-time'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) {
    throw new Error(`API ${res.status}: ${(await res.text().catch(() => '')) || res.statusText}`)
  }

  const data = (await res.json()) as {
    ok?: boolean
    token?: string
    role?: 'ADMIN' | 'MODERATOR' | 'USER'
  }

  if (data?.token) {
    // ✅ persist with correct role token
    if (data.role === 'ADMIN') setAdminToken(data.token)
    else if (data.role === 'MODERATOR') setModeratorToken(data.token)
    else setToken(data.token)
  }

  return data
}

/**
 * ✅ Align to backend: GET /api/adoption/my
 */
export async function myAdoptedAnimals(): Promise<MyAdoptedItem[]> {
  const res = await fetch(apiUrl('/api/adoption/my'), {
    headers: { 'Content-Type': 'application/json', ...authHeader() },
  })
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${(await res.text().catch(() => '')) || res.statusText}`)
  }
  return res.json()
}

/** Backward compatible alias */
export async function getAdoptionMe() {
  return myAdoptedAnimals()
}

/** Mark all new updates for given animal as seen — ✅ aligns to /api/adoption/seen */
export async function markAnimalSeen(animalId: string): Promise<{ ok: boolean }> {
  const res = await fetch(apiUrl('/api/adoption/seen'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ animalId }),
  })
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${(await res.text().catch(() => '')) || res.statusText}`)
  }
  return res.json()
}

export async function startAdoption(animalId: string, email: string, name: string, monthly: number) {
  const res = await fetch(apiUrl('/api/adoption/start'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ animalId, email, name, monthly }),
  })
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${(await res.text().catch(() => '')) || res.statusText}`)
  }
  return res.json()
}

export async function endAdoption(animalId: string) {
  const res = await fetch(apiUrl('/api/adoption/end'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ animalId }),
  })
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${(await res.text().catch(() => '')) || res.statusText}`)
  }
  return res.json()
}

// ---- Posts ----

export async function listPostsPublic(params?: { animalId?: string; limit?: number }) {
  const q = new URLSearchParams()
  if (params?.animalId) q.set('animalId', params.animalId)
  if (params?.limit) q.set('limit', String(params.limit))
  const qs = q.toString() ? `?${q.toString()}` : ''

  const res = await fetch(apiUrl(`/api/posts/public${qs}`), {
    headers: { 'Content-Type': 'application/json' },
  })
  if (res.ok) return res.json()

  if (res.status === 404) {
    const q2 = new URLSearchParams(q)
    q2.set('public', 'true')
    const alt = await fetch(apiUrl(`/api/posts?${q2.toString()}`), {
      headers: { 'Content-Type': 'application/json' },
    })
    if (!alt.ok) {
      throw new Error(`API ${alt.status}: ${(await alt.text().catch(() => '')) || alt.statusText}`)
    }
    return alt.json()
  }

  throw new Error(`API ${res.status}: ${(await res.text().catch(() => '')) || res.statusText}`)
}

export async function createPost(post: {
  animalId: string
  title: string
  text: string
  media?: { key: string; type: 'image' | 'video' }[]
}) {
  const res = await fetch(apiUrl('/api/posts'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(post),
  })
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${(await res.text().catch(() => '')) || res.statusText}`)
  }
  return res.json()
}

// ---- Uploads ----

function detectMediaType(file: File): 'image' | 'video' {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  return 'image'
}

export async function uploadMedia(file: File) {
  const fd = new FormData()
  fd.append('file', file)

  const res = await fetch(apiUrl('/api/upload'), {
    method: 'POST',
    headers: { ...authHeader() },
    body: fd,
  })
  if (!res.ok) {
    throw new Error(`Upload ${res.status}: ${(await res.text().catch(() => '')) || res.statusText}`)
  }

  const data = await res.json().catch(() => ({}))
  const payload = (data?.data ?? data) as any

  return {
    url: payload.url,
    key: payload.key,
    type: (payload.type as any) || detectMediaType(file),
  }
}

export async function uploadMediaMany(files: File[]) {
  const out: any[] = []
  for (const f of files) {
    // eslint-disable-next-line no-await-in-loop
    out.push(await uploadMedia(f))
  }
  return out
}

// ---- Moderators (Admin only) ----

export async function listModerators() {
  return getJSON<Moderator[]>('/api/admin/moderators', {
    headers: { ...authHeader() } as HeadersInit,
  })
}

export async function createModerator(
  email: string,
  password: string,
  role: 'MODERATOR' | 'ADMIN' = 'MODERATOR',
) {
  const res = await fetch(apiUrl('/api/admin/moderators'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ email, password, role }),
  })
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${(await res.text().catch(() => '')) || res.statusText}`)
  }
  return res.json()
}

export async function updateModerator(id: string, patch: Partial<Moderator>) {
  const res = await fetch(apiUrl(`/api/admin/moderators/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${(await res.text().catch(() => '')) || res.statusText}`)
  }
  return res.json()
}

export async function deleteModerator(id: string) {
  const res = await fetch(apiUrl(`/api/admin/moderators/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    headers: { ...authHeader() },
  })
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${(await res.text().catch(() => '')) || res.statusText}`)
  }
  return res.json()
}

export async function resetModeratorPassword(id: string, newPassword: string) {
  const res = await fetch(apiUrl(`/api/admin/moderators/${encodeURIComponent(id)}/password`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ password: newPassword }),
  })
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${(await res.text().catch(() => '')) || res.statusText}`)
  }
  return res.json()
}

// ---- Tax (admin + public token form) ----

export async function sendTaxRequestByEmail(email: string) {
  const clean = email.trim().toLowerCase()

  const res = await fetch(apiUrl('/api/tax/send'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ email: clean }),
  })

  if (!res.ok) {
    throw new Error(`API ${res.status}: ${(await res.text().catch(() => '')) || res.statusText}`)
  }

  return res.json() as Promise<{ ok: boolean; sentTo: string; expiresAt: string; link: string }>
}

export type AdminTaxUser = {
  id: string
  email: string
  hasTaxProfile: boolean
  profileComplete: boolean
}

export async function adminTaxUsers(): Promise<AdminTaxUser[]> {
  const res = await fetch(apiUrl('/api/tax/admin/users'), {
    headers: { 'Content-Type': 'application/json', ...authHeader() },
  })
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${(await res.text().catch(() => '')) || res.statusText}`)
  }
  const data = (await res.json()) as { ok?: boolean; users?: AdminTaxUser[] }
  return Array.isArray(data.users) ? data.users : []
}

export async function sendTaxBatch(payload: { emails?: string[]; userIds?: string[]; recheck?: boolean }) {
  const res = await fetch(apiUrl('/api/tax/send-batch'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${(await res.text().catch(() => '')) || res.statusText}`)
  }
  return res.json() as Promise<{
    ok: boolean
    processed: number
    results: Array<{ email: string; ok: boolean; error?: string }>
  }>
}

export async function runTaxCertificates(payload: {
  year?: number
  dryRun?: boolean
  includePledges?: boolean
  emails?: string[]
  userIds?: string[]
  limit?: number
}) {
  const res = await fetch(apiUrl('/api/tax-certificates/run'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${(await res.text().catch(() => '')) || res.statusText}`)
  }
  return res.json()
}

export type TaxTokenInfo = {
  ok: boolean
  token: string
  expiresAt: string
  user: { id: string; email: string }
  taxProfile: any | null
  defaults: {
    firstName?: string | null
    lastName?: string | null
    street?: string | null
    streetNo?: string | null
    zip?: string | null
    city?: string | null
  }
}

export async function getTaxTokenInfo(token: string) {
  return getJSON<TaxTokenInfo>(`/api/tax/token/${encodeURIComponent(token)}`)
}

export async function submitTaxToken(token: string, payload: any) {
  const res = await fetch(apiUrl(`/api/tax/token/${encodeURIComponent(token)}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${(await res.text().catch(() => '')) || res.statusText}`)
  }
  return res.json()
}

// ---- small helper (debug) ----
export function currentTokenForDebug() {
  return getToken()
}