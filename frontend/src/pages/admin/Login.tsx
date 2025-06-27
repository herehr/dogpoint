import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Container,
  TextField,
  Typography,
  Box,
} from '@mui/material';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

 const handleLogin = async () => {
  try {
    const res = await axios.post(
      `${import.meta.env.VITE_API_BASE_URL}/api/auth/admin-login`,
      {
        email,
        password,
      }
    );

    sessionStorage.setItem('adminToken', res.data.token);
    navigate('/admin/moderators');
  } catch (err) {
    alert('Přihlášení selhalo');
    console.error(err);
  }
};

  return (
    <Container maxWidth="sm">
      <Box mt={8} className="space-y-4">
        <Typography variant="h4" align="center">
          Přihlášení administrátora
        </Typography>
        <TextField
          fullWidth
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          fullWidth
          label="Heslo"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button variant="contained" fullWidth onClick={handleLogin}>
          Přihlásit se
        </Button>
      </Box>
    </Container>
  );
}