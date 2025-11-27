import React, { useEffect, useState } from 'react'
import { Box, Container, Typography, List, ListItem, ListItemText, Chip } from '@mui/material'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api' // adapt to your API helper

type Notification = {
  id: string
  title: string
  message: string
  createdAt: string
  readAt: string | null
}

export default function NotificationsPage() {
  const { token } = useAuth()
  const [items, setItems] = useState<Notification[]>([])

  useEffect(() => {
    const load = async () => {
      if (!token) return
      const res = await api.get('/notifications/my')
      setItems(res.data.items)
    }
    load()
  }, [token])

  return (
    <Box sx={{ backgroundColor: '#26E6EA', minHeight: '100vh', py: 4 }}>
      <Container maxWidth="md">
        <Typography variant="h4" gutterBottom>
          Notifikace
        </Typography>
        {items.length === 0 ? (
          <Typography>Nemáte žádné notifikace.</Typography>
        ) : (
          <List>
            {items.map(n => (
              <ListItem key={n.id} alignItems="flex-start" sx={{ bgcolor: '#fff', mb: 1, borderRadius: 2 }}>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="subtitle1" fontWeight={700}>
                        {n.title}
                      </Typography>
                      {!n.readAt && <Chip label="Nové" color="primary" size="small" />}
                    </Box>
                  }
                  secondary={
                    <>
                      <Typography variant="body2" color="textSecondary">
                        {n.message}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {new Date(n.createdAt).toLocaleString('cs-CZ')}
                      </Typography>
                    </>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </Container>
    </Box>
  )
}