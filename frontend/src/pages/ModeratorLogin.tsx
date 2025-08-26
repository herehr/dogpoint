import React, { useState } from 'react'
import { loginModerator, saveToken } from '../auth/authService'
import { useNavigate } from 'react-router-dom'
import { Container, TextField, Button, Typography } from '@mui/material'

const ModeratorLogin: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const navigate = useNavigate()

  const handleLogin = async () => {
    try {
      const token = await loginModerator(email, password)
      saveToken(token)
      navigate('/moderator/dashboard')
    } catch {
      alert('Chyba přihlášení')
    }
  }

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Typography variant="h4" gutterBottom>Přihlášení moderátora</Typography>
      <TextField fullWidth margin="normal" label="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <TextField fullWidth margin="normal" label="Heslo" type="password" value={password} onChange={e => setPassword(e.target.value)} />
      <Button variant="contained" fullWidth sx={{ mt: 2 }} onClick={handleLogin}>Přihlásit se</Button>
    </Container>
  )
}

export default ModeratorLogin