// frontend/src/services/api.ts
// Centralized API helpers. Uses VITE_API_BASE_URL for prod (DO) & local.

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

if (!BASE_URL) {
  // Helpful during misconfig
  // eslint-disable-next-line no-console
  console.warn('VITE_API_BASE_URL is not defined. Set it in your environment (DO or local).');
}

export type GalerieMedia = {
  id?: string;
  url: string;
  typ?: 'image' | 'video';
};

export type Animal = {
  id: string;
  name?: string;        // EN
  jmeno?: string;       // CZ
  description?: string; // EN
  popis?: string;       // CZ
  galerie?: GalerieMedia[];
};

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} for GET ${path}`);
  }
  return res.json() as Promise<T>;
}

// --- Named exports used by pages/components ---

/** List all animals */
export async function fetchAnimals(): Promise<Animal[]> {
  return getJSON<Animal[]>('/api/animals');
}

/** Get single animal by id */
export async function fetchAnimal(id: string): Promise<Animal> {
  if (!id) throw new Error('fetchAnimal: id is required');
  return getJSON<Animal>(`/api/animals/${encodeURIComponent(id)}`);
}