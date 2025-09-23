// frontend/src/pages/UserAccount.tsx
import React, { useEffect, useState } from 'react'
import { Container, Typography, Alert, List, ListItem, ListItemText } from '@mui/material'
import { getMyAdoptions } from '../services/api'

type Adoption = {
  animal: { id: string; jmeno: string; main?: string | null; active: boolean }
  monthly?: number | null
  hasNew: boolean
}

export default function UserAccount() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adoptions, setAdoptions] = useState<Adoption[]>([])

  useEffect(() => {
    getMyAdoptions()
      .then(setAdoptions)
      .catch((e) => setError(e?.message || 'Načítání selhalo'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ fontWeight: 900, mb: 2 }}>
        Moje adopce
      </Typography>

      {loading && <Typography>Načítám…</Typography>}
      {error && <Alert severity="error">{error}</Alert>}

      {!loading && !error && adoptions.length === 0 && (
        <Typography>Zatím nemáte žádné adopce.</Typography>
      )}

      <List>
        {adoptions.map((a) => (
          <ListItem key={a.animal.id}>
            <ListItemText
              primary={a.animal.jmeno}
              secondary={`Měsíční příspěvek: ${a.monthly ?? 'n/a'} Kč ${
                a.hasNew ? ' – nové příspěvky!' : ''
              }`}
            />
          </ListItem>
        ))}
      </List>
    </Container>
  )
}