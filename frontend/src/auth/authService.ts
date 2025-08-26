export async function loginModerator(email: string, password: string): Promise<string> {
  const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/moderator-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })

  if (!res.ok) throw new Error('Login failed')

  const data = await res.json()
  return data.token
}

export function saveToken(token: string) {
  sessionStorage.setItem('moderatorToken', token)
}

export function getToken(): string | null {
  return sessionStorage.getItem('moderatorToken')
}