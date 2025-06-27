import React, { useState } from 'react';
import {
  Container,
  Typography,
  TextField,
  Button,
  Stack,
  Box,
  Alert,
} from '@mui/material';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const ModeratorLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const res = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/api/auth/moderator-login`, {
        email,
        password,
      });

      const { token } = res.data;
      sessionStorage.setItem('moderatorToken', token); // ✅ JWT speichern
      navigate('/moderator');
    } catch (err: any) {
      const message =
        err.response?.data?.error || 'Chyba při přihlášení moderátora.';
      setError(message);
    }
  };

  return (
    <Container maxWidth="xs" sx={{ mt: 8 }}>
      <Typography variant="h5" align="center" gutterBottom>
        Přihlášení moderátora
      </Typography>

      {error && <Alert severity="error">{error}</Alert>}

      <Box component="form" onSubmit={handleLogin}>
        <Stack spacing={2}>
          <TextField
            label="Email"
            type="email"
            fullWidth
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
          <TextField
            label="Heslo"
            type="password"
            fullWidth
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" variant="contained" fullWidth>
            Přihlásit se
          </Button>
        </Stack>
      </Box>
    </Container>
  );
};

export default ModeratorLogin;