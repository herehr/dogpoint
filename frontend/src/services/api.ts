// frontend/src/services/api.ts
// Centralized API helper for the frontend.
// IMPORTANT: Do NOT include '/api' in VITE_API_BASE_URL.
//   dev:  VITE_API_BASE_URL=http://localhost:3000
//   prod: VITE_API_BASE_URL=https://dp-backend-xxxx.ondigitalocean.app

// ---- Base URL ---------------------------------------------------------------

const API_BASE =
  (import.meta as any)?.env?.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  ''

if (!API_BASE) {
  // eslint-disable-next-line no-console
  console.warn('[API] VITE_API_BASE_URL is not set. Calls will fail.')
}

/** Ensure we join base + path safely. Accepts either '/api/x' or 'api/x'. */
export const apiUrl = (path: string) => {
  const base = (API_BASE || '').replace(/\/$/, '')
  const normalized = `/${path.replace(/^\/?/, '')}` // force single leading slash
  return `${base}${normalized}`
}

// ---- Token storage ----------------------------------------------------------

const TOKEN_KEY = 'dp:authToken'

export function getToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string, persist = false) {
  try {
    // session by default; optionally persist across sessions
    if (persist) {
      localStorage.setItem(TOKEN_KEY, token)
      sessionStorage.removeItem(TOKEN_KEY)
    } else {
      sessionStorage.setItem(TOKEN_KEY, token)
      localStorage.removeItem(TOKEN_KEY)
    }
  } catch {}
}

export function clearToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(TOKEN_KEY)
  } catch {}
}

// ---- Core fetch helpers -----------------------------------------------------

export async function claimPaid(email: string) {
  const res = await postJSON<{ ok: true; token: string; role: MeResponse['role'] }>(
    '/api/auth/claim-paid',
    { email }
  )
  setToken(res.token) // store JWT so /me works and content unblurs
  return res
}

// (optional)
export function logout() {
  clearToken()
}

async function parseError(res: Response) {
  let bodyText = ''
  try {
    bodyText = await res.text()
  } catch {}
  const snippet = bodyText?.slice(0, 400) || ''
  return `API ${res.status} ${res.statusText} @ ${res.url} :: ${snippet}`
}

export async function getJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const url = apiUrl(path)
  const token = getToken()
  try {
    const res = await fetch(url, {
      ...init,
      method: 'GET',
      headers: {
        ...(init?.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      // credentials: 'include', // enable if you ever switch to cookie sessions
    })
    if (!res.ok) throw new Error(await parseError(res))
    return (await res.json()) as T
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('[API][GET]', { url, error: err?.message || err })
    throw err
  }
}

export async function postJSON<T>(
  path: string,
  body?: any,
  init?: RequestInit
): Promise<T> {
  const url = apiUrl(path)
  const token = getToken()
  try {
    const res = await fetch(url, {
      method: 'POST',
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!res.ok) throw new Error(await parseError(res))
    return (await res.json()) as T
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('[API][POST]', { url, error: err?.message || err, body })
    throw err
  }
}

// ---- Health (optional) ------------------------------------------------------

export const apiHealth = {
  root: () => getJSON<{ ok: boolean; component: string }>('/'),
  server: () => getJSON<{ status: string; server: boolean }>('/health'),
  db: () => getJSON<{ status: string; db: boolean }>('/health/db'),
}

// ---- Animals ---------------------------------------------------------------

export type AnimalListItem = {
  id: string
  jmeno: string | null
  name: string | null
  popis: string | null
  description: string | null
  main?: string | null
}

export async function getAnimals(params?: { limit?: number; active?: boolean }) {
  const q = new URLSearchParams()
  if (params?.limit) q.set('limit', String(params.limit))
  if (typeof params?.active === 'boolean') q.set('active', String(params.active))
  const path = q.toString() ? `/api/animals?${q.toString()}` : '/api/animals'
  return getJSON<AnimalListItem[]>(path)
}

export async function getAnimal(id: string) {
  return getJSON<AnimalListItem>(`/api/animals/${encodeURIComponent(id)}`)
}

// ---- Auth -------------------------------------------------------------------

export type MeResponse = {
  id: string
  email: string
  role: 'USER' | 'MODERATOR' | 'ADMIN'
  animals?: string[] // from /me helper
}

export async function me(): Promise<MeResponse> {
  return getJSON<MeResponse>('/api/auth/me')
}

export async function login(email: string, password: string) {
  const res = await postJSON<{ token: string; role: MeResponse['role'] }>(
    '/api/auth/login',
    { email, password }
  )
  setToken(res.token) // session storage by default
  return res
}

export async function setPasswordFirstTime(email: string, password: string) {
  const res = await postJSON<{ ok: true; token: string; role: MeResponse['role'] }>(
    '/api/auth/set-password-first-time',
    { email, password }
  )
  setToken(res.token)
  return res
}

export async function registerAfterPayment(email: string, password: string) {
  const res = await postJSON<{ ok: true; token: string; role: MeResponse['role'] }>(
    '/api/auth/register-after-payment',
    { email, password }
  )
  setToken(res.token)
  return res
}

// ---- Stripe (optional client helper) ---------------------------------------
// Usually you’ll call this from your PaymentButtons component,
// but it’s handy to have a typed helper here too.

export async function createCheckoutSession(input: {
  animalId: string
  amountCZK: number
  email?: string
  name?: string
}): Promise<{ url: string | undefined }> {
  return postJSON<{ url?: string }>('/api/stripe/checkout-session', input)
}