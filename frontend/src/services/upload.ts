export async function uploadFile(file: File, token: string): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  })

  if (!res.ok) throw new Error('File upload failed')

  const data = await res.json()
  return data.url
}