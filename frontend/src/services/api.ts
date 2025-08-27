// Centralized API helpers — NO template literals.
// Works with VITE_API_BASE_URL in Vite (prod & local).

const RAW: string = (import.meta as any).env?.VITE_API_BASE_URL || '';
const BASE_URL: string = RAW.replace(/\/+$/, '');

if (!BASE_URL) {
  // eslint-disable-next-line no-console
  console.warn('VITE_API_BASE_URL is not defined. Set it in DO Frontend → Environment Variables.');
}

function authHeader(): Record<string, string> {
  const token = sessionStorage.getItem('accessToken');
  return token ? { Authorization: 'Bearer ' + token } : {};
}

async function req<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE_URL + path, {
    headers: Object.assign(
      { 'Content-Type': 'application/json' },
      authHeader(),
      (init && init.headers) ? init.headers : {}
    ),
    ...(init || {}),
  });
  if (!res.ok) {
    let text = '';
    try { text = await res.text(); } catch {}
    throw new Error(String(res.status) + ' ' + res.statusText + ' for ' + path + ' → ' + text);
  }
  return res.json() as Promise<T>;
}

export type GalerieMedia = { id?: string; url: string; typ?: 'image' | 'video' };
export type Animal = {
  id: string;
  name?: string; jmeno?: string;
  description?: string; popis?: string;
  galerie?: GalerieMedia[];
  active?: boolean;
};

export async function fetchAnimals(): Promise<Animal[]> {
  return req<Animal[]>('/api/animals');
}

export async function fetchAnimal(id: string): Promise<Animal> {
  if (!id) throw new Error('fetchAnimal: id is required');
  return req<Animal>('/api/animals/' + encodeURIComponent(id));
}

export async function loginModerator(email: string, password: string) {
  const data = await req<{ token: string; role: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  sessionStorage.setItem('accessToken', data.token);
  return data;
}

export function logout() {
  sessionStorage.removeItem('accessToken');
}

export async function createAnimal(payload: Partial<Animal>) {
  return req<Animal>('/api/animals', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateAnimal(id: string, payload: Partial<Animal>) {
  return req<Animal>('/api/animals/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function deleteAnimal(id: string) {
  return req<{ ok: true }>('/api/animals/' + encodeURIComponent(id), { method: 'DELETE' });
}

export async function uploadMedia(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append('file', file);
  const token = sessionStorage.getItem('accessToken');
  const res = await fetch(BASE_URL + '/api/upload', {
    method: 'POST',
    headers: token ? { Authorization: 'Bearer ' + token } : {},
    body: form,
  });
  if (!res.ok) throw new Error('Upload failed: ' + res.status);
  return res.json();
}

export async function listModerators() {
  return req<Array<{ id: string; email: string; role: string; active?: boolean }>>('/api/admin/moderators');
}
