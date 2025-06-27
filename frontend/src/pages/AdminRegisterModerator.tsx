import React, { useState } from 'react';
import {
  Container,
  TextField,
  Button,
  Typography,
  Box,
  Alert
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const AdminRegisterModerator: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async () => {
    const token = sessionStorage.getItem('adminToken');
    if (!token) {
      setMessage({ type: 'error', text: '❌ Admin token not found. Please log in.' });
      return;
    }

    if (!email || !password) {
      setMessage({ type: 'error', text: '❌ Vyplňte e-mail i heslo.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/api/create-moderator`,
        { email, password },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMessage({ type: 'success', text: `✅ Moderátor vytvořen: ${res.data.email}` });
      setEmail('');
      setPassword('');
      setTimeout(() => navigate('/admin/moderators'), 1000);
    } catch (error: any) {
      setMessage({
        type: 'error',
        text:
          '❌ Chyba při vytváření moderátora. ' +
          (error.response?.data?.error || 'Zkuste to prosím znovu.'),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Typography variant="h4" gutterBottom>
        Vytvořit moderátora
      </Typography>

      <Box display="flex" flexDirection="column" gap={2}>
        <TextField
          label="Email"
          type="email"
          value={email}
          fullWidth
          required
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Heslo"
          type="password"
          value={password}
          fullWidth
          required
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? 'Odesílám…' : 'Vytvořit moderátora'}
        </Button>
        {message && (
          <Alert severity={message.type} sx={{ mt: 2 }}>
            {message.text}
          </Alert>
        )}
      </Box>
    </Container>
  );
};

export default AdminRegisterModerator;