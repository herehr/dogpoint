// frontend/src/services/api.ts

// --- Base URL ---
const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') || '';

/** Build a full API URL from a path, e.g. apiUrl('/api/animals') */
export function apiUrl(path = ''): string {
  return `${API_BASE}${path}`;
}

const tokenKey = 'accessToken';

// ---- Token helpers ----
export function setToken(token: string) {
  try {
    sessionStorage.setItem(tokenKey, token);
  } catch {}
}

export function getToken(): string | null {
  try {
    return sessionStorage.getItem(tokenKey);
  } catch {
    return null;
  }
}

export function clearToken() {
  try {
    sessionStorage.removeItem(tokenKey);
  } catch {}
}

// Back-compat names used elsewhere:
export { setToken as setAuthToken, getToken as getAuthToken, clearToken as clearAuthToken };

// ---- HTTP helpers ----
type FetchOpts = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

function buildHeaders(json = true): HeadersInit {
  const h: Record<string, string> = {};
  if (json) h['Content-Type'] = 'application/json';
  const t = getToken();
  if (t) h['Authorization'] = `Bearer ${t}`;
  return h;
}

async function doFetch<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const url = apiUrl(path);
  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers: { ...buildHeaders(opts.body !== undefined), ...(opts.headers || {}) },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
    credentials: 'omit',
  });

  let data: any = null;
  const text = await res.text();
  try { data = text ? JSON.parse(text) : null; } catch {}

  if (!res.ok) {
    const msg = data?.error || data?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

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

// ---- Domain calls used across the app ----

// Auth
export type MeResponse = {
  id: string;
  email: string;
  role: 'ADMIN' | 'MODERATOR' | 'USER';
  animals?: string[];            // list of animalIds from subscriptions (ACTIVE+PENDING)
  myAdoptions?: string[];        // optional, if backend returns separate alias
  subscriptions?: any[];         // optional shape
};

export async function me(): Promise<MeResponse> {
  return getJSON<MeResponse>('/api/auth/me');
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

// Auto-claim after Stripe redirect (paid=1&sid=...)
export async function claimPaid(email: string, sessionId?: string) {
  const res = await postJSON<{ ok: true; token: string; role: MeResponse['role'] }>(
    '/api/auth/claim-paid',
    { email, sessionId }
  );
  setToken(res.token);
  return res;
}

// Stripe checkout session
export async function createCheckoutSession(params: {
  animalId: string;
  amountCZK: number;
  email?: string;
  name?: string;
}) {
  // Your backend route (mounted at /api):
  // POST /api/stripe/checkout-session
  return postJSON<{ url: string }>('/api/stripe/checkout-session', params);
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
  return getJSON<Animal>(`/api/animals/${id}`);
}

// Optional convenience
export function logout() {
  clearToken();
}