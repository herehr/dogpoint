// frontend/src/components/PostsSection.tsx
import React, { useEffect, useState } from 'react'
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material'
import { createPost, listPostsPublic } from '../services/api'
import { useAccess } from '../context/AccessContext'

type Post = {
  id: string
  animalId: string
  authorId?: string
  title: string
  body?: string
  createdAt: string
}

export default function PostsSection({ animalId }: { animalId: string }) {
  const { hasAccess } = useAccess()
  const unlocked = hasAccess(animalId)

  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  async function refresh() {
    setErr(null)
    try {
      const list = await listPostsPublic({ animalId })
      setPosts(list)
    } catch (e: any) {
      setErr(e?.message || 'Načítání příspěvků selhalo')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [animalId])

  async function onAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true); setErr(null)
    try {
      await createPost({ animalId, title: title.trim(), body: body.trim() })
      setTitle(''); setBody('')
      refresh()
    } catch (e: any) {
      setErr(e?.message || 'Uložení selhalo')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box sx={{ mt: 5 }}>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
        Příspěvky
      </Typography>

      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      {loading ? (
        <Typography color="text.secondary">Načítám…</Typography>
      ) : posts.length === 0 ? (
        <Typography color="text.secondary">Zatím žádné příspěvky.</Typography>
      ) : (
        <Stack spacing={1.5}>
          {posts.map(p => (
            <Box key={p.id} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <Typography sx={{ fontWeight: 700 }}>{p.title}</Typography>
              {p.body && <Typography color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>{p.body}</Typography>}
              <Typography variant="caption" color="text.secondary">{new Date(p.createdAt).toLocaleString()}</Typography>
            </Box>
          ))}
        </Stack>
      )}

      {/* Write form only after unlock */}
      {unlocked && (
        <Box component="form" onSubmit={onAdd} sx={{ mt: 2 }}>
          <Stack spacing={1}>
            <TextField label="Titulek" value={title} onChange={e => setTitle(e.target.value)} required />
            <TextField label="Text" value={body} onChange={e => setBody(e.target.value)} multiline minRows={2} />
            <Button type="submit" variant="contained" disabled={saving}>{saving ? 'Ukládám…' : 'Přidat příspěvek'}</Button>
          </Stack>
        </Box>
      )}
    </Box>
  )
}