const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
if (!BASE_URL) { console.warn('VITE_API_BASE_URL is not defined. Set it in your environment (DO or local).'); }

function authHeader() {
  const token = sessionStorage.getItem('accessToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function req(path: string, init?: RequestInit) {
  const res = await fetch(\`\${BASE_URL}\${path}\`, {
    headers: { 'Content-Type': 'application/json', ...authHeader(), ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(\`\${res.status} \${res.statusText} for \${path} → \${text}\`);
  }
  return res.json();
}

export type GalerieMedia = { id?: string; url: string; typ?: 'image' | 'video' };
export type Animal = { id: string; name?: string; jmeno?: string; description?: string; popis?: string; galerie?: GalerieMedia[]; active?: boolean };

export async function fetchAnimals(): Promise<Animal[]> {
  return req('/api/animals');
}

export async function fetchAnimal(id: string): Promise<Animal> {
  if (!id) throw new Error('fetchAnimal: id is required');
  return req(\`/api/animals/\${encodeURIComponent(id)}\`);
}

export async function loginModerator(email: string, password: string) {
  const data = await req('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  sessionStorage.setItem('accessToken', data.token);
  return data;
}

export function logout() {
  sessionStorage.removeItem('accessToken');
}

export async function createAnimal(payload: Partial<Animal>) {
  return req('/api/animals', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateAnimal(id: string, payload: Partial<Animal>) {
  return req(\`/api/animals/\${encodeURIComponent(id)}\`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function deleteAnimal(id: string) {
  return req(\`/api/animals/\${encodeURIComponent(id)}\`, { method: 'DELETE' });
}

export async function uploadMedia(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append('file', file);
  const token = sessionStorage.getItem('accessToken');
  const res = await fetch(\`\${BASE_URL}/api/upload\`, {
    method: 'POST',
    headers: token ? { Authorization: \`Bearer \${token}\` } : {},
    body: form,
  });
  if (!res.ok) throw new Error(\`Upload failed: \${res.status}\`);
  return res.json();
}

export async function listModerators() {
  return req('/api/admin/moderators');
}
