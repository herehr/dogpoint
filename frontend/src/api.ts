// frontend/src/api.ts

const BASE_URL = import.meta.env.VITE_API_BASE_URL

export async function getAnimals() {
  const r = await fetch(`${BASE_URL}/api/animals`)
  if (!r.ok) throw new Error(`API ${r.status}`)
  return r.json()
}

export async function getAdoptionMe(): Promise<{
  ok: boolean
  user: { id: string; email: string; role: string }
  access: Record<string, boolean>
}> {
  const r = await fetch(`${BASE_URL}/api/adoption/me`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionStorage.getItem('accessToken') || ''}`,
    },
  })
  if (!r.ok) throw new Error(`API ${r.status}`)
  return r.json()
}