/**
 * Central API helper for Dogpoint frontend.
 * Works for both local dev (Vite) and production (DO).
 */

const API_BASE =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || ''; // remove trailing slash if present

/** Generic fetch wrapper with consistent error messages */
async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`API ${res.status} ${res.statusText}: ${text || url}`);
    }

    return (await res.json()) as T;
  } catch (err: any) {
    console.error('[API ERROR]', url, err);
    throw new Error(`Failed to load ${url}: ${err.message || err}`);
  }
}

/**
 * Fetch all animals (used for /zvirata and homepage teasers)
 */
export async function getAnimals(limit?: number, active = true) {
  const query = new URLSearchParams();
  if (limit) query.set('limit', String(limit));
  if (active) query.set('active', 'true');

  const data = await apiFetch<Array<{
    id: string;
    jmeno: string | null;
    name: string | null;
    popis: string | null;
    description: string | null;
  }>>(`/api/animals?${query.toString()}`);

  return data;
}

/**
 * Fetch a single animal by ID
 */
export async function getAnimal(id: string) {
  return apiFetch<{
    id: string;
    jmeno: string | null;
    name: string | null;
    popis: string | null;
    description: string | null;
    galerie: Array<{ url: string; typ: string }>;
  }>(`/api/animals/${id}`);
}

export { API_BASE };