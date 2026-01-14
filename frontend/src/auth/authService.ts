// frontend/src/auth/authService.ts

const KEY = 'moderatorToken'

export async function loginModerator(email: string, password: string): Promise<string> {
  const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/moderator-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) throw new Error('Login failed')

  const data = await res.json()

  // ✅ persist token (continuous login)
  setModeratorToken(data.token)

  return data.token
}

export function setModeratorToken(token: string) {
  try {
    localStorage.setItem(KEY, token)   // persistent
  } catch {}
  try {
    sessionStorage.setItem(KEY, token) // backward compatibility
  } catch {}
}

export function getModeratorToken(): string | null {
  try {
    return localStorage.getItem(KEY) || sessionStorage.getItem(KEY)
  } catch {
    try {
      return sessionStorage.getItem(KEY)
    } catch {
      return null
    }
  }
}

export function clearModeratorToken() {
  try {
    localStorage.removeItem(KEY)
  } catch {}
  try {
    sessionStorage.removeItem(KEY)
  } catch {}
}