// frontend/src/api.ts
const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function getAnimals() {
  const r = await fetch(`${BASE_URL}/api/animals`);
  if (!r.ok) throw new Error(`API ${r.status}`);
  return r.json();
}