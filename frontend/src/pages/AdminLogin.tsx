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

const AdminLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/auth/admin-login`, // ✅ FIXED LINE
        {
          email,
          password,
        }
      );

      const { token } = res.data;

      // ✅ Store the JWT token
      sessionStorage.setItem('adminToken', token);

      // ✅ Redirect to admin area
      navigate('/admin/moderators');
    } catch (err: any) {
      const message =
        err.response?.data?.error || 'Chyba při přihlášení admina.';
      setError(message);
    }
  };

  return (
    <Container maxWidth="xs" sx={{ mt: 8 }}>
      <Typography variant="h5" align="center" gutterBottom>
        Přihlášení Admina
      </Typography>

      {error && <Alert severity="error">{error}</Alert>}

      <Box component="form" onSubmit={handleLogin} sx={{ mt: 2 }}>
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

export default AdminLogin;