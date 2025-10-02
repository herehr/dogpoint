// frontend/src/services/api.ts
// Centralized API helper for the frontend (used by sections/pages).
// IMPORTANT: Do NOT include '/api' in VITE_API_BASE_URL.
//   dev:  VITE_API_BASE_URL=http://localhost:3000
//   prod: VITE_API_BASE_URL=https://dp-backend-3vysi.ondigitalocean.app

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  ''

/** Build absolute URL to backend */
export const apiUrl = (path: string) => {
  const base = (API_BASE || '').replace(/\/$/, '')
  // Ensure path starts with a single leading slash
  const p = path.startsWith('http')
    ? path
    : `/${path.replace(/^\/?/, '')}` // -> '/api/animals' if 'api/animals' was passed
  return `${base}${p}`
}

async function parseError(res: Response) {
  let bodyText = ''
  try {
    bodyText = await res.text()
  } catch {}
  const snippet = bodyText?.slice(0, 400) || ''
  return `API ${res.status} ${res.statusText} @ ${res.url} :: ${snippet}`
}

export async function getJSON<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const url = apiUrl(path)
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
      // credentials: 'include', // uncomment if you need cookies/sessions
    })
    if (!res.ok) {
      throw new Error(await parseError(res))
    }
    return (await res.json()) as T
  } catch (err: any) {
    // Helpful console for quick diagnosis
    // eslint-disable-next-line no-console
    console.error('[API]', { url, error: err?.message || err })
    throw err
  }
}

// Optional: quick health checks you can call from anywhere
export const apiHealth = {
  root: () => getJSON<{ ok: boolean; component: string }>('/'),
  server: () => getJSON<{ status: string; server: boolean }>('/health'),
  db: () => getJSON<{ status: string; db: boolean }>('/health/db'),
}