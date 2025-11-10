// Centralized API helper for the frontend.

const API_BASE =
  (import.meta as any)?.env?.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  ''

if (!API_BASE) {
  console.warn('[API] VITE_API_BASE_URL is not set. Calls will fail.')
}

export const apiUrl = (path: string) => {
  const base = (API_BASE || '').replace(/\/$/, '')
  const normalized = `/${path.replace(/^\/?/, '')}`
  return `${base}${normalized}`
}

// ---- Token storage (re-exported by services/auth.ts) ------------------------
const TOKEN_KEY = 'dp:authToken'
export function getToken(): string | null {
  try { return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) } catch { return null }
}
export function setToken(token: string, persist = false) {
  try {
    if (persist) { localStorage.setItem(TOKEN_KEY, token); sessionStorage.removeItem(TOKEN_KEY) }
    else { sessionStorage.setItem(TOKEN_KEY, token); localStorage.removeItem(TOKEN_KEY) }
  } catch {}
}
export function clearToken() { try { sessionStorage.removeItem(TOKEN_KEY); localStorage.removeItem(TOKEN_KEY) } catch {} }

// ---- Core fetch -------------------------------------------------------------
async function parseError(res: Response) {
  let bodyText = ''
  try { bodyText = await res.text() } catch {}
  return `API ${res.status} ${res.statusText} @ ${res.url} :: ${bodyText?.slice(0, 400) || ''}`
}
export async function getJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const url = apiUrl(path)
  const token = getToken()
  try {
    const res = await fetch(url, {
      ...init,
      method: 'GET',
      headers: { ...(init?.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })
    if (!res.ok) throw new Error(await parseError(res))
    return (await res.json()) as T
  } catch (err: any) {
    console.error('[API][GET]', { url, error: err?.message || err })
    throw err
  }
}
export async function postJSON<T>(path: string, body?: any, init?: RequestInit): Promise<T> {
  const url = apiUrl(path)
  const token = getToken()
  try {
    const res = await fetch(url, {
      method: 'POST',
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!res.ok) throw new Error(await parseError(res))
    return (await res.json()) as T
  } catch (err: any) {
    console.error('[API][POST]', { url, error: err?.message || err, body })
    throw err
  }
}

// ---- Auth -------------------------------------------------------------------
export type MeResponse = { id: string; email: string; role: 'USER' | 'MODERATOR' | 'ADMIN'; animals?: string[] }
export async function me(): Promise<MeResponse> { return getJSON<MeResponse>('/api/auth/me') }

export async function login(email: string, password: string) {
  const res = await postJSON<{ token: string; role: MeResponse['role'] }>('/api/auth/login', { email, password })
  setToken(res.token)
  return res
}

export async function setPasswordFirstTime(email: string, password: string) {
  const res = await postJSON<{ ok: true; token: string; role: MeResponse['role'] }>(
    '/api/auth/set-password-first-time', { email, password }
  )
  setToken(res.token); return res
}

export async function registerAfterPayment(email: string, password: string) {
  const res = await postJSON<{ ok: true; token: string; role: MeResponse['role'] }>(
    '/api/auth/register-after-payment', { email, password }
  )
  setToken(res.token); return res
}

// Used by AnimalDetail auto-claim (supports optional session id)
export async function claimPaid(email: string, sessionId?: string) {
  const res = await postJSON<{ ok: true; token: string; role: MeResponse['role'] }>(
    '/api/auth/claim-paid', { email, sessionId }
  )
  setToken(res.token); return res
}

export function logout() { clearToken() }