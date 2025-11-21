// frontend/src/services/api.ts

// ---------- Base URL ----------
const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') || ''

export function apiUrl(path = ''): string {
  return `${API_BASE}${path}`
}

// ---------- Token helpers ----------
const tokenKey = 'accessToken'

export function setToken(token: string) {
  try {
    sessionStorage.setItem(tokenKey, token)
  } catch {}
}
export function getToken(): string | null {
  try {
    return sessionStorage.getItem(tokenKey)
  } catch {
    return null
  }
}
export function clearToken() {
  try {
    sessionStorage.removeItem(tokenKey)
  } catch {}
}

// Back-compat aliases
export {
  setToken as setAuthToken,
  getToken as getAuthToken,
  clearToken as clearAuthToken,
}

export function authHeader(): Record<string, string> {
  const t = getToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

// ---------- Utilities ----------
export function qs(obj?: Record<string, string | number | boolean | undefined | null>) {
  if (!obj) return ''
  const sp = new URLSearchParams()
  Object.entries(obj).forEach(([k, v]) => {
    if (v == null) return
    sp.set(k, String(v))
  })
  const s = sp.toString()
  return s ? `?${s}` : ''
}

class AbortControllerMerge {
  private c = new AbortController()
  public signal = this.c.signal
  constructor(signals: AbortSignal[]) {
    const onAbort = () => this.c.abort()
    signals.forEach(s => {
      if (s.aborted) this.c.abort()
      else s.addEventListener('abort', onAbort, { once: true })
    })
  }
}

// ---------- HTTP core ----------
type FetchOpts = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: any
  headers?: Record<string, string>
  signal?: AbortSignal
  timeoutMs?: number
  autoLogoutOn401?: boolean // kept for compatibility, but no longer clears token
}

function buildHeaders(body: any, headers?: Record<string, string>): HeadersInit {
  const h: Record<string, string> = { ...(headers || {}) }
  const t = getToken()
  if (t && !h['Authorization']) h['Authorization'] = `Bearer ${t}`
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
  if (!isFormData && body !== undefined && !h['Content-Type']) {
    h['Content-Type'] = 'application/json'
  }
  return h
}

async function doFetch<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const controller = new AbortController()
  const timeout = opts.timeoutMs ?? 20000
  const timer = setTimeout(() => controller.abort(), timeout)

  const signal = opts.signal
    ? new AbortControllerMerge([controller.signal, opts.signal]).signal
    : controller.signal

  const isFormData = typeof FormData !== 'undefined' && opts.body instanceof FormData

  try {
    const res = await fetch(apiUrl(path), {
      method: opts.method || 'GET',
      headers: buildHeaders(opts.body, opts.headers),
      body: isFormData
        ? (opts.body as FormData)
        : opts.body !== undefined
          ? JSON.stringify(opts.body)
          : undefined,
      credentials: 'omit',
      signal,
    })

    const ct = res.headers.get('content-type') || ''
    const isJson = /\bapplication\/json\b/i.test(ct)

    if (!res.ok) {
      let serverMsg = ''
      let serverDetail = ''
      try {
        if (isJson) {
          const errJson = await res.json()
          serverMsg = errJson?.error || errJson?.message || ''
          serverDetail = errJson?.detail || ''
        } else {
          serverMsg = await res.text()
        }
      } catch {}
      // IMPORTANT:
      // We no longer clearToken() automatically on 401 here.
      const msg =
        (serverMsg || `HTTP ${res.status}`) +
        (serverDetail ? ` – ${serverDetail}` : '')
      throw new Error(msg)
    }

    if (res.status === 204) return undefined as T
    const data = isJson ? await res.json() : ((await res.text()) as any)
    return data as T
  } finally {
    clearTimeout(timer)
  }
}

export function getJSON<T>(path: string, opts?: Omit<FetchOpts, 'method' | 'body'>) {
  return doFetch<T>(path, { ...opts, method: 'GET' })
}
export function postJSON<T>(path: string, body?: any, opts?: Omit<FetchOpts, 'method'>) {
  return doFetch<T>(path, { ...opts, method: 'POST', body })
}
export function patchJSON<T>(path: string, body?: any, opts?: Omit<FetchOpts, 'method'>) {
  return doFetch<T>(path, { ...opts, method: 'PATCH', body })
}
export function delJSON<T>(path: string, opts?: Omit<FetchOpts, 'method' | 'body'>) {
  return doFetch<T>(path, { ...opts, method: 'DELETE' })
}

// ---------- Auth & Me ----------
export type MeResponse = {
  id: string
  email: string
  role: 'ADMIN' | 'MODERATOR' | 'USER'
  animals?: string[]
  myAdoptions?: string[]
  subscriptions?: any[]
}

export async function me(): Promise<MeResponse> {
  // You can still pass autoLogoutOn401:true if you want,
  // but doFetch no longer clears the token implicitly.
  return getJSON<MeResponse>('/api/auth/me', { autoLogoutOn401: true })
}

export async function login(email: string, password: string) {
  const res = await postJSON<{ token: string; role: MeResponse['role'] }>(
    '/api/auth/login',
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

export async function setPasswordFirstTime(email: string, password: string) {
  const res = await postJSON<{ ok: true; token: string; role: MeResponse['role'] }>(
    '/api/auth/set-password-first-time',
    { email, password }
  )
  setToken(res.token)
  return res
}

export async function claimPaid(email: string, sessionId?: string) {
  const res = await postJSON<{ ok: true; token: string; role: MeResponse['role'] }>(
    '/api/auth/claim-paid',
    { email, sessionId }
  )
  setToken(res.token)
  return res
}

// ---------- Stripe helpers ----------
export type ConfirmStripeResp = {
  ok: boolean
  token?: string
  email?: string
  status?: 'PAID' | 'PENDING'
}

export async function confirmStripeSession(sid: string): Promise<ConfirmStripeResp> {
  return getJSON<ConfirmStripeResp>(`/api/stripe/confirm${qs({ sid })}`)
}

export async function createCheckoutSession(params: {
  animalId: string
  amountCZK: number
  email?: string
  name?: string
  password?: string
}) {
  return postJSON<{ id?: string; url: string }>(
    '/api/stripe/checkout-session',
    params
  )
}

// Stash helpers
const PENDING_EMAIL_KEY = 'dp:pendingEmail'
const PENDING_USER_KEY = 'dp:pendingUser'

export function stashPendingEmail(email?: string) {
  if (!email) return
  try {
    localStorage.setItem(PENDING_EMAIL_KEY, email)
    localStorage.setItem(PENDING_USER_KEY, JSON.stringify({ email }))
  } catch {}
}

export function popPendingEmail(): string | undefined {
  try {
    const stash = localStorage.getItem(PENDING_USER_KEY)
    if (stash) {
      const parsed = JSON.parse(stash)
      if (parsed?.email) return String(parsed.email)
    }
    const fallback = localStorage.getItem(PENDING_EMAIL_KEY)
    if (fallback) {
      localStorage.removeItem(PENDING_EMAIL_KEY)
      return String(fallback)
    }
  } catch {}
  return undefined
}

// ---------- Animals ----------
export type Animal = {
  id: string
  jmeno?: string
  name?: string
  popis?: string
  description?: string
  main?: string
  galerie?: Array<{ url: string; type?: 'image' | 'video' }>
  birthDate?: string | Date | null
  bornYear?: number | null
  vek?: string
  active?: boolean
  charakteristik?: string
}

export async function fetchAnimal(id: string): Promise<Animal> {
  return getJSON<Animal>(`/api/animals/${encodeURIComponent(id)}`)
}

// ---------- User / Adoptions ----------
export type MyAdoptedItem = {
  animalId: string
  title?: string
  name?: string
  jmeno?: string
  main?: string
  since?: string
  status?: 'ACTIVE' | 'PENDING' | 'CANCELED'
}

/**
 * Prefer backend /api/adoption/my.
 * If 404 (route not present yet), fallback to /api/auth/me and build items from ids.
 */
export async function myAdoptedAnimals(): Promise<MyAdoptedItem[]> {
  try {
    // IMPORTANT: no autoLogoutOn401 here.
    return await getJSON<MyAdoptedItem[]>('/api/adoption/my')
  } catch (e: any) {
    const msg = (e?.message || '').toString()
    if (/404/.test(msg)) {
      const m = await me()
      const ids =
        (m.myAdoptions && m.myAdoptions.length ? m.myAdoptions : m.animals) ||
        []
      return ids.map((id: string) => ({ animalId: id, status: 'ACTIVE' as const }))
    }
    throw e
  }
}
export async function cancelAdoption(animalId: string): Promise<{ ok: true }> {
  return postJSON<{ ok: true }>('/api/adoption/cancel', { animalId })
}

/* ---------- NEW: getAdoptionMe for AccessContext ---------- */

export type AdoptionMeResponse = {
  ok: boolean
  user?: { id: string; email: string; role?: string }
  access?: Record<string, boolean>
}

/**
 * Used by AccessContext to know which animals this user has access to.
 * - Calls /api/adoption/my → builds access map { [animalId]: true }
 * - Calls /api/auth/me → returns basic user object
 */
export async function getAdoptionMe(): Promise<AdoptionMeResponse> {
  // Load adopted animals (Subscriptions) via /api/adoption/my
  const list = await myAdoptedAnimals() // re-use logic above

  const access: Record<string, boolean> = {}
  for (const it of list) {
    if (it && it.animalId) {
      access[it.animalId] = true
    }
  }

  // Optionally load user info from /api/auth/me
  let user: any = undefined
  try {
    user = await me()
  } catch {
    // ignore – access map is still valid even if /me fails
  }

  return { ok: true, user, access }
}

export async function markAnimalSeen(animalId: string): Promise<{ ok: true }> {
  // if route exists
  try {
    return await postJSON<{ ok: true }>('/api/adoption/seen', { animalId })
  } catch {
    // ignore if not implemented server-side
    return { ok: true }
  }
}

// ---------- Uploads ----------
export async function uploadMedia(file: File) {
  const fd = new FormData()
  fd.append('file', file)
  return doFetch<{ data?: { url: string; key?: string; type?: 'image' | 'video' } }>(
    '/api/upload',
    { method: 'POST', body: fd }
  )
}

// Optional convenience
export function logout() {
  clearToken()
}