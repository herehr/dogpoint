// frontend/src/pages/AdminLogin.tsx
import React, { useState } from 'react'
import { Container, Box, Typography, TextField, Button, Paper, Stack } from '@mui/material'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Admin login attempt:', { email, password })
    // TODO: integrate with backend /api/auth/admin-login
  }

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 3, textAlign: 'center' }}>
          Přihlášení administrátora
        </Typography>
        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={2}>
            <TextField
              label="E-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="Heslo"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              required
            />
            <Button type="submit" variant="contained" size="large">
              Přihlásit se
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Container>
  )
}