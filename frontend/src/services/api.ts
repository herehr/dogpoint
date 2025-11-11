const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export async function fetchAnimals() {
  const res = await fetch(`${API_BASE_URL}/animals`)
  if (!res.ok) throw new Error('Failed to fetch animals')
  return res.json()
}

export async function fetchAnimal(id: string) {
  const res = await fetch(`${API_BASE_URL}/animals/${id}`)
  if (!res.ok) throw new Error('Failed to fetch animal')
  return res.json()
}