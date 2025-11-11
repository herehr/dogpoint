// frontend/src/services/api.ts
// Low-level HTTP + auth helpers (single source of truth).

// ---------- Base URL ----------
export const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') || ''

/** Build a full API URL from a path, e.g. apiUrl('/api/animals') */
export function apiUrl(path = ''): string {
  return `${API_BASE}${path}`
}

// ---------- Token helpers ----------
const tokenKey = 'accessToken'
export function setToken(token: string) { try { sessionStorage.setItem(tokenKey, token) } catch {} }
export function getToken(): string | null { try { return sessionStorage.getItem(tokenKey) } catch { return null } }
export function clearToken() { try { sessionStorage.removeItem(tokenKey) } catch {} }

export function authHeader(): Record<string, string> {
  const t = getToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

// ---------- Core HTTP ----------
export type FetchOpts = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: any
  headers?: Record<string, string>
  timeoutMs?: number
}

function buildHeaders(body: any, headers?: Record<string, string>): HeadersInit {
  const h: Record<string, string> = { ...(headers || {}) }
  const t = getToken()
  if (t && !h['Authorization']) h['Authorization'] = `Bearer ${t}`
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
  if (!isFormData && body !== undefined && !h['Content-Type']) h['Content-Type'] = 'application/json'
  return h
}

export async function doFetch<T = any>(path: string, opts: FetchOpts = {}): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20000)
  try {
    const res = await fetch(apiUrl(path), {
      method: opts.method || 'GET',
      headers: buildHeaders(opts.body, opts.headers),
      body: opts.body && !(opts.body instanceof FormData) ? JSON.stringify(opts.body) : opts.body,
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    const ct = res.headers.get('content-type') || ''
    const isJson = ct.includes('application/json')
    return isJson ? res.json() : (res.text() as any)
  } finally {
    clearTimeout(timer)
  }
}

// ---------- JSON wrappers ----------
export function getJSON<T = any>(path: string, opts?: Omit<FetchOpts, 'method' | 'body'>) {
  return doFetch<T>(path, { ...opts, method: 'GET' })
}
export function postJSON<T = any>(path: string, body?: any, opts?: Omit<FetchOpts, 'method'>) {
  return doFetch<T>(path, { ...opts, method: 'POST', body })
}
export function patchJSON<T = any>(path: string, body?: any, opts?: Omit<FetchOpts, 'method'>) {
  return doFetch<T>(path, { ...opts, method: 'PATCH', body })
}
export function delJSON<T = any>(path: string, opts?: Omit<FetchOpts, 'method' | 'body'>) {
  return doFetch<T>(path, { ...opts, method: 'DELETE' })
}

// ---------- Upload helper ----------
export async function uploadMedia(file: File) {
  const fd = new FormData()
  fd.append('file', file)
  return doFetch<{ data?: { url: string; key?: string; type?: 'image' | 'video' } }>(
    '/api/upload',
    { method: 'POST', body: fd }
  )
}