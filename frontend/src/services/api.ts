// frontend/src/services/api.ts

/* =========================================================
   Base URL
========================================================= */

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') || ''

export function apiUrl(path = ''): string {
  return `${API_BASE}${path}`
}

/* =========================================================
   Token helpers (persistent login)
========================================================= */

const tokenKey = 'accessToken'

function safeGet(key: string): string | null {
  try {
    const v = localStorage.getItem(key)
    if (v) return v
  } catch {}
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {}
  try {
    sessionStorage.setItem(key, value)
  } catch {}
}

function safeRemove(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {}
  try {
    sessionStorage.removeItem(key)
  } catch {}
}

/** generic (kept for compatibility) */
export function setToken(token: string) {
  try {
    safeSet(tokenKey, token)
  } catch {}
}

/** ✅ store ADMIN token (and keep accessToken in sync) */
export function setAdminToken(token: string) {
  try {
    safeSet('adminToken', token)
    safeSet(tokenKey, token)
    safeRemove('moderatorToken')
  } catch {}
}

/** ✅ store MODERATOR token (and keep accessToken in sync) */
export function setModeratorToken(token: string) {
  try {
    safeSet('moderatorToken', token)
    safeSet(tokenKey, token)
    safeRemove('adminToken')
  } catch {}
}

/** ✅ optional helper (non-breaking) */
export function getAdminToken(): string | null {
  return (
    safeGet('adminToken') ||
    safeGet('admin_accessToken') ||
    safeGet('adminTokenLegacy') ||
    null
  )
}

/**
 * ✅ FIX (kept + extended safely):
 * Prefer adminToken BEFORE accessToken.
 * Also tolerate legacy keys without changing current behavior.
 */
export function getToken(): string | null {
  try {
    // 1) Admin first (most important for protected CSV / stats)
    const admin =
      safeGet('adminToken') ||
      safeGet('admin_accessToken') ||
      safeGet('adminTokenLegacy')
    if (admin) return admin

    // 2) Current primary token key
    const t = safeGet(tokenKey)
    if (t) return t

    // 3) Moderator / legacy fallbacks
    return (
      safeGet('moderatorToken') ||
      safeGet('token') ||
      (() => {
        try {
          return (
            localStorage.getItem('dp:token') ||
            sessionStorage.getItem('dp:token') ||
            localStorage.getItem('token') ||
            sessionStorage.getItem('token') ||
            null
        )
        } catch {
          return null
        }
      })()
    )
  } catch {
    return null
  }
}

export function clearToken() {
  try {
    safeRemove(tokenKey)
    safeRemove('adminToken')
    safeRemove('admin_accessToken')
    safeRemove('adminTokenLegacy')
    safeRemove('moderatorToken')
    safeRemove('token')
    try {
      localStorage.removeItem('dp:token')
      sessionStorage.removeItem('dp:token')
      localStorage.removeItem('token')
      sessionStorage.removeItem('token')
    } catch {}
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

/* =========================================================
   Utilities
========================================================= */

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
    signals.forEach((s) => {
      if (s.aborted) this.c.abort()
      else s.addEventListener('abort', onAbort, { once: true })
    })
  }
}

/* =========================================================
   HTTP core
========================================================= */

type FetchOpts = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: any
  headers?: Record<string, string>
  signal?: AbortSignal
  timeoutMs?: number
  autoLogoutOn401?: boolean
}

function buildHeaders(body: any, headers?: Record<string, string>): HeadersInit {
  const h: Record<string, string> = { ...(headers || {}) }
  const t = getToken()
  if (t && !h.Authorization) h.Authorization = `Bearer ${t}`

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
      credentials: 'include',
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

      const msg = (serverMsg || `HTTP ${res.status}`) + (serverDetail ? ` – ${serverDetail}` : '')
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

/* =========================================================
   Auth & Me
========================================================= */

export type MeResponse = {
  id: string
  email: string
  role: 'ADMIN' | 'MODERATOR' | 'USER'
  animals?: string[]
  myAdoptions?: string[]
  subscriptions?: any[]
}

export async function me(): Promise<MeResponse> {
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

/* =========================================================
   Stripe helpers
========================================================= */

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
  return postJSON<{ id?: string; url: string }>('/api/stripe/checkout-session', params)
}

/* =========================================================
   Bank transfer: 2-step flow
========================================================= */

export async function startBankAdoption(payload: {
  animalId: string
  amountCZK: number
  name: string
  email: string
  password: string
  vs: string
}) {
  return postJSON<{ ok: boolean; token?: string; userId?: string; subscriptionId?: string; accessUntil?: string }>(
    '/api/adoption-bank/start',
    { ...payload, sendEmail: false }
  )
}

export async function sendBankPaymentDetailsEmail(payload: {
  animalId: string
  amountCZK: number
  name: string
  email: string
  password: string
  vs: string
}) {
  return postJSON<{ ok: boolean; token?: string }>('/api/adoption-bank/send-email', payload)
}
export const sendBankPaymentEmail = sendBankPaymentDetailsEmail

/**
 * ✅ FIXED: backend route is /paid-email (not /paid)
 */
export async function sendBankPaidEmail(payload: {
  animalId: string
  amountCZK: number
  name: string
  email: string
  password: string
  vs: string
}) {
  return postJSON<{ ok: boolean; token?: string }>('/api/adoption-bank/paid-email', payload)
}

export async function startBankAdoptionAndSendPdf(payload: {
  animalId: string
  amountCZK: number
  name: string
  email: string
  password: string
  vs: string
  sendEmail?: boolean
}) {
  return postJSON<{
    ok: boolean
    token?: string
    userId?: string
    subscriptionId?: string
    bankIban?: string
    bankName?: string
    vs?: string
    amountCZK?: number
    sendEmail?: boolean
  }>('/api/adoption-bank/start', payload)
}

/* =========================================================
   Stash helpers (after payment)
========================================================= */

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

/* =========================================================
   Animals
========================================================= */

export type Animal = {
  id: string
  jmeno?: string
  name?: string
  popis?: string
  description?: string
  main?: string
  galerie?: Array<{ url: string; type?: 'image' | 'video'; typ?: 'image' | 'video' }>
  birthDate?: string | Date | null
  bornYear?: number | null
  vek?: string
  active?: boolean
  charakteristik?: string
}

export async function fetchAnimal(id: string): Promise<Animal> {
  return getJSON<Animal>(`/api/animals/${encodeURIComponent(id)}`)
}

/* =========================================================
   User / Adoptions
========================================================= */

export type MyAdoptedItem = {
  animalId: string
  title?: string
  name?: string
  jmeno?: string
  main?: string
  since?: string
  status?: 'ACTIVE' | 'PENDING' | 'CANCELED'
}

function normalizeToMyAdoptedItem(x: any): MyAdoptedItem | null {
  if (!x) return null

  const animalId =
    x.animalId ||
    x.animal?.id ||
    x.subscription?.animalId ||
    x.subscription?.animal?.id

  if (!animalId) return null

  const status = (x.status || x.subscription?.status || 'ACTIVE') as MyAdoptedItem['status']

  const animal = x.animal || x.subscription?.animal || {}
  const title = x.title || animal.title || animal.jmeno || animal.name
  const main = x.main || animal.main
  const since = x.since || x.startedAt || x.subscription?.startedAt

  return {
    animalId: String(animalId),
    status,
    title,
    jmeno: x.jmeno || animal.jmeno,
    name: x.name || animal.name,
    main,
    since: since ? String(since) : undefined,
  }
}

export async function myAdoptedAnimals(): Promise<MyAdoptedItem[]> {
  const byAnimal = new Map<string, MyAdoptedItem>()

  const rank = (s?: MyAdoptedItem['status']) => {
    if (s === 'ACTIVE') return 3
    if (s === 'PENDING') return 2
    if (s === 'CANCELED') return 1
    return 0
  }

  const put = (it: MyAdoptedItem | null) => {
    if (!it?.animalId) return
    const prev = byAnimal.get(it.animalId)
    if (!prev) {
      byAnimal.set(it.animalId, it)
      return
    }
    const best = rank(it.status) > rank(prev.status) ? it : prev
    byAnimal.set(it.animalId, {
      ...best,
      title: best.title || (best === it ? prev.title : it.title),
      main: best.main || (best === it ? prev.main : it.main),
      since: best.since || (best === it ? prev.since : it.since),
      jmeno: best.jmeno || (best === it ? prev.jmeno : it.jmeno),
      name: best.name || (best === it ? prev.name : it.name),
    })
  }

  try {
    const raw = await getJSON<any[]>('/api/adoption/my')
    for (const x of raw || []) put(normalizeToMyAdoptedItem(x))
  } catch (e: any) {
    const msg = String(e?.message || '')
    if (!/404/.test(msg)) {
      // no-op
    }
  }

  try {
    const m = await me()
    const subs = (m.subscriptions || []) as any[]
    for (const s of subs) {
      const st = (s.status || 'ACTIVE') as string
      if (st === 'CANCELED') continue
      if (!(st === 'ACTIVE' || st === 'PENDING')) continue
      put(normalizeToMyAdoptedItem(s))
    }
  } catch {
    // ignore
  }

  const out = Array.from(byAnimal.values()).filter((it) => it.status !== 'CANCELED')
  out.sort((a, b) => rank(b.status) - rank(a.status))
  return out
}

export async function cancelAdoption(animalId: string): Promise<{ ok: true }> {
  return postJSON<{ ok: true }>('/api/adoption/cancel', { animalId })
}

export type AdoptionMeResponse = {
  ok: boolean
  user?: { id: string; email: string; role?: string }
  access?: Record<string, boolean>
}

export async function getAdoptionMe(): Promise<AdoptionMeResponse> {
  const list = await myAdoptedAnimals()

  const access: Record<string, boolean> = {}
  for (const it of list) {
    if (it?.animalId) access[it.animalId] = true
  }

  let user: any = undefined
  try {
    user = await me()
  } catch {}

  return { ok: true, user, access }
}

export async function markAnimalSeen(animalId: string): Promise<{ ok: true }> {
  try {
    return await postJSON<{ ok: true }>('/api/adoption/seen', { animalId })
  } catch {
    return { ok: true }
  }
}

/* =========================================================
   Uploads
========================================================= */

export async function uploadMedia(
  file: File
): Promise<{ url: string; key?: string; type?: 'image' | 'video' }> {
  const fd = new FormData()
  fd.append('file', file)
  return doFetch<{ url: string; key?: string; type?: 'image' | 'video' }>(
    '/api/upload',
    { method: 'POST', body: fd }
  )
}

/* =========================================================
   Logout
========================================================= */

export function logout() {
  clearToken()
}

/* =========================================================
   Notifications for "my" adopted animals
========================================================= */

export type MyNotificationItem = {
  id: string
  title: string
  body?: string | null
  publishedAt: string
  animalId: string
  animalName: string
  media?: { url: string; typ?: string; type?: string; poster?: string; posterUrl?: string }[]
}

export async function fetchMyAdoptions(): Promise<any[]> {
  const t = getToken()
  if (!t) throw new Error('Nejste přihlášen.')

  const res = await fetch(apiUrl('/api/adoption/my'), {
    headers: { Authorization: `Bearer ${t}` },
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`Načtení adopcí selhalo: ${res.status}`)
  return await res.json()
}

export async function fetchPostsForAnimal(animalId: string): Promise<any[]> {
  const res = await fetch(
    apiUrl(`/api/posts/public?animalId=${encodeURIComponent(animalId)}`)
  )
  if (!res.ok) throw new Error(`Načtení příspěvků selhalo: ${res.status}`)
  return await res.json()
}

export async function fetchMyNotifications(): Promise<MyNotificationItem[]> {
  const adoptions = await fetchMyAdoptions()

  const active = (adoptions || []).filter(
    (a: any) => !a.status || a.status === 'ACTIVE' || a.status === 'PENDING'
  )

  const allPostsPerAnimal = await Promise.all(
    active.map(async (ad: any) => {
      const animal = ad.animal || {}
      const animalId = ad.animalId || animal.id
      if (!animalId) return []

      const posts = await fetchPostsForAnimal(animalId)
      const animalName = animal.jmeno || animal.name || 'Zvíře'

      return (posts || []).map((p: any) => ({
        id: p.id,
        title: p.title,
        body: p.body,
        publishedAt: p.publishedAt || p.createdAt,
        animalId,
        animalName,
        media: p.media || [],
      })) as MyNotificationItem[]
    })
  )

  const flat = allPostsPerAnimal.flat()

  flat.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )

  return flat
}

/* =========================================================
   Optional default export (legacy)
========================================================= */

const api = {
  apiUrl,
  setToken,
  setAdminToken,
  setModeratorToken,
  getAdminToken,
  getToken,
  clearToken,
  authHeader,
  qs,
  getJSON,
  postJSON,
  patchJSON,
  delJSON,
  me,
  login,
  registerAfterPayment,
  setPasswordFirstTime,
  claimPaid,
  confirmStripeSession,
  createCheckoutSession,

  startBankAdoption,
  sendBankPaymentEmail,
  sendBankPaidEmail,
  startBankAdoptionAndSendPdf,

  stashPendingEmail,
  popPendingEmail,
  fetchAnimal,
  myAdoptedAnimals,
  cancelAdoption,
  getAdoptionMe,
  markAnimalSeen,
  uploadMedia,
  logout,
  fetchMyAdoptions,
  fetchPostsForAnimal,
  fetchMyNotifications,
}

export default api