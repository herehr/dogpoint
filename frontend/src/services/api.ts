// frontend/src/services/api.ts
// Uses VITE_API_BASE_URL so production (DO) calls the correct backend

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

if (!BASE_URL) {
  // Helpful warning if the env var wasn't provided at build time
  // Check DO → Frontend → Settings → Environment Variables
  // eslint-disable-next-line no-console
  console.warn(
    'VITE_API_BASE_URL is not defined. Set it in DigitalOcean App Platform (Frontend).'
  );
}

export async function fetchAnimals() {
  const res = await fetch(`${BASE_URL}/api/animals`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`GET ${BASE_URL}/api/animals failed with ${res.status}`);
  }
  return res.json();
}