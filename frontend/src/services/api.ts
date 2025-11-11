// frontend/src/services/api.ts

// ---------- Base URL ----------
const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') || '';

/** Build a full API URL from a path, e.g. apiUrl('/api/animals') */
export function apiUrl(path = ''): string {
  return `${API_BASE}${path}`;
}

// ---------- Token helpers ----------
const tokenKey = 'accessToken';

export function setToken(token: string) {
  try { sessionStorage.setItem(tokenKey, token); } catch {}
}
export function getToken(): string | null {
  try { return sessionStorage.getItem(tokenKey); } catch { return null; }
}
export function clearToken() {
  try { sessionStorage.removeItem(tokenKey); } catch {}
}

// Back-compat aliases used elsewhere:
export {
  setToken as setAuthToken,
  getToken as getAuthToken,
  clearToken as clearAuthToken,
};

// Optional legacy helper (some files import it)
export function authHeader(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// ---------- Utilities ----------
/** Build query string from a simple object */
export function qs(obj?: Record<string, string | number | boolean | undefined | null>) {
  if (!obj) return '';
  const sp = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
}

// ---------- HTTP core ----------
type FetchOpts = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: any;                      // object (JSON) or FormData
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;              // abort after this time
  autoLogoutOn401?: boolean;       // clear token if 401
};

// Build headers; skip JSON header for FormData
function buildHeaders(body: any, headers?: Record<string, string>): HeadersInit {
  const h: Record<string, string> = { ...(headers || {}) };
  const t = getToken();
  if (t && !h['Authorization']) h['Authorization'] = `Bearer ${t}`;

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (!isFormData && body !== undefined && !h['Content-Type']) {
    h['Content-Type'] = 'application/json';
  }
  return h;
}

async function doFetch<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = opts.timeoutMs ?? 20000;
  const timer = setTimeout(() => controller.abort(), timeout);

  // merge signals if provided
  const signal = opts.signal
    ? new AbortControllerMerge([controller.signal, opts.signal]).signal
    : controller.signal;

  const isFormData = typeof FormData !== 'undefined' && opts.body instanceof FormData;

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
    });

    // Decide how to parse
    const ct = res.headers.get('content-type') || '';
    const isJson = /\bapplication\/json\b/i.test(ct);

    if (!res.ok) {
      // Try to read server error message + detail
      let serverMsg = '';
      let serverDetail = '';
      try {
        if (isJson) {
          const errJson = await res.json();
          serverMsg = errJson?.error || errJson?.message || '';
          serverDetail = errJson?.detail || '';
        } else {
          serverMsg = await res.text();
        }
      } catch {}
      if (res.status === 401 && opts.autoLogoutOn401) {
        clearToken();
      }
      const msg = (serverMsg || `HTTP ${res.status}`) + (serverDetail ? ` – ${serverDetail}` : '');
      throw new Error(msg);
    }

    if (res.status === 204) return undefined as T; // no content
    const data = isJson ? await res.json() : ((await res.text()) as any);
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Merge multiple AbortSignals (tiny helper) */
class AbortControllerMerge {
  private c = new AbortController();
  public signal = this.c.signal;
  constructor(signals: AbortSignal[]) {
    const onAbort = () => this.c.abort();
    signals.forEach(s => {
      if (s.aborted) this.c.abort();
      else s.addEventListener('abort', onAbort, { once: true });
    });
  }
}

// Convenience wrappers
export function getJSON<T>(path: string, opts?: Omit<FetchOpts, 'method' | 'body'>) {
  return doFetch<T>(path, { ...opts, method: 'GET' });
}
export function postJSON<T>(path: string, body?: any, opts?: Omit<FetchOpts, 'method'>) {
  return doFetch<T>(path, { ...opts, method: 'POST', body });
}
export function patchJSON<T>(path: string, body?: any, opts?: Omit<FetchOpts, 'method'>) {
  return doFetch<T>(path, { ...opts, method: 'PATCH', body });
}
export function delJSON<T>(path: string, opts?: Omit<FetchOpts, 'method' | 'body'>) {
  return doFetch<T>(path, { ...opts, method: 'DELETE' });
}

// ---------- Domain calls ----------
// Types (minimal)
export type MeResponse = {
  id: string;
  email: string;
  role: 'ADMIN' | 'MODERATOR' | 'USER';
  animals?: string[];      // animalIds from subscriptions (ACTIVE+PENDING)
  myAdoptions?: string[];  // optional alias
  subscriptions?: any[];   // optional
};

// Auth
export async function me(): Promise<MeResponse> {
  return getJSON<MeResponse>('/api/auth/me', { autoLogoutOn401: true });
}

export async function login(email: string, password: string) {
  const res = await postJSON<{ token: string; role: MeResponse['role'] }>(
    '/api/auth/login',
    { email, password }
  );
  setToken(res.token);
  return res;
}

export async function registerAfterPayment(email: string, password: string) {
  const res = await postJSON<{ ok: true; token: string; role: MeResponse['role'] }>(
    '/api/auth/register-after-payment',
    { email, password }
  );
  setToken(res.token);
  return res;
}

export async function setPasswordFirstTime(email: string, password: string) {
  const res = await postJSON<{ ok: true; token: string; role: MeResponse['role'] }>(
    '/api/auth/set-password-first-time',
    { email, password }
  );
  setToken(res.token);
  return res;
}

// Auto-claim after Stripe redirect (?paid=1&sid=...)
export async function claimPaid(email: string, sessionId?: string) {
  const res = await postJSON<{ ok: true; token: string; role: MeResponse['role'] }>(
    '/api/auth/claim-paid',
    { email, sessionId }
  );
  setToken(res.token);
  return res;
}

// --- Stripe confirm (after success redirect) ---
export type ConfirmStripeResp = {
  ok: boolean
  token?: string
  email?: string
}

export async function confirmStripeSession(sid: string): Promise<ConfirmStripeResp> {
  return getJSON<ConfirmStripeResp>(`/api/stripe/confirm${qs({ sid })}`)
}

// Stash helpers used before redirect (optional, but handy)
export function stashPendingEmail(email?: string) {
  if (!email) return
  try {
    localStorage.setItem('dp:pendingEmail', email)
    localStorage.setItem('dp:pendingUser', JSON.stringify({ email }))
  } catch {}
}

export function popPendingEmail(): string | undefined {
  try {
    const stash = localStorage.getItem('dp:pendingUser')
    if (stash) {
      const parsed = JSON.parse(stash)
      if (parsed?.email) return String(parsed.email)
    }
    const fallback = localStorage.getItem('dp:pendingEmail')
    if (fallback) return String(fallback)
  } catch {}
  return undefined
}

// Stripe checkout session (backend returns { url })
export async function createCheckoutSession(params: {
  animalId: string;
  amountCZK: number;
  email?: string;
  name?: string;
}) {
  return postJSON<{ url: string }>('/api/stripe/checkout-session', params);
}

// simple helpers to keep the email around
const PENDING_EMAIL_KEY = 'dp:pendingEmail'
export function stashPendingEmail(email?: string) {
  try { if (email) localStorage.setItem(PENDING_EMAIL_KEY, email) } catch {}
}
export function popPendingEmail(): string | '' {
  try {
    const v = localStorage.getItem(PENDING_EMAIL_KEY)
    if (v) localStorage.removeItem(PENDING_EMAIL_KEY)
    return v || ''
  } catch { return '' }
}

// confirm the session after redirect to pull token + email
export async function confirmStripeSession(sid: string) {
  return getJSON<{ ok: true; token?: string; email?: string }>(`/api/stripe/confirm?sid=${encodeURIComponent(sid)}`)
}

// Animals
export type Animal = {
  id: string;
  jmeno?: string;
  name?: string;
  popis?: string;
  description?: string;
  main?: string;
  galerie?: Array<{ url: string; type?: 'image' | 'video' }>;
  birthDate?: string | Date | null;
  bornYear?: number | null;
  vek?: string;
  active?: boolean;
  charakteristik?: string;
};

export async function fetchAnimal(id: string): Promise<Animal> {
  return getJSON<Animal>(`/api/animals/${encodeURIComponent(id)}`);
}

// Uploads (safe for FormData)
export async function uploadMedia(file: File) {
  const fd = new FormData();
  fd.append('file', file);
  return doFetch<{ data?: { url: string; key?: string; type?: 'image' | 'video' } }>(
    '/api/upload',
    { method: 'POST', body: fd }
  );
}

// Optional convenience
export function logout() {
  clearToken();
}