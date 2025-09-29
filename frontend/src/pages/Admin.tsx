import React from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Container, Typography, Button, Stack } from '@mui/material'

export default function Admin() {
  const { logout, token } = useAuth()
  const navigate = useNavigate()

  function onLogout() {
    logout()
    navigate('/', { replace: true })
  }

  return (
    <Container sx={{ py: 6 }}>
      <Typography variant="h4" sx={{ fontWeight: 900, mb: 2 }}>
        Admin dashboard
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 4 }}>
        Vítejte v administraci.
      </Typography>

      <Stack direction="row" spacing={2}>
        <Button variant="contained" onClick={() => navigate('/admin/moderators')}>
          Správa moderátorů
        </Button>
        <Button variant="contained" onClick={() => navigate('/admin/animals')}>
          Správa zvířat
        </Button>
        <Button color="inherit" onClick={onLogout}>
          Odhlásit
        </Button>
      </Stack>
    </Container>
  )
}