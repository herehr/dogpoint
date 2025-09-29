// frontend/src/services/api.ts
// Centralized API helper for the frontend (used by sections/pages).
// IMPORTANT: Do NOT include '/api' in VITE_API_BASE_URL.
//   dev:  VITE_API_BASE_URL=http://localhost:3000
//   prod: VITE_API_BASE_URL=https://dp-backend-3vysi.ondigitalocean.tld

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  '';

/** Build absolute URL to backend */
export const apiUrl = (path: string) => {
  const base = (API_BASE || '').replace(/\/$/, '');
  if (path.startsWith('http')) return path;
  return `${base}${path}`;
};

export async function getJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}