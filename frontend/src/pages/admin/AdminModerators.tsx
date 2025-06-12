import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Container,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Box,
  CircularProgress,
  Alert,
  Stack,
} from '@mui/material';

interface Moderator {
  id: string;
  email: string;
  active: boolean;
  createdAt: string;
}

export default function AdminModerators() {
  const [moderators, setModerators] = useState<Moderator[] | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchModerators = async () => {
    const token = sessionStorage.getItem('adminToken');
    if (!token) {
      setError('⚠️ Admin token not found. Please log in again.');
      return;
    }

    try {
      const res = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/api/admin/moderators`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setModerators(res.data);
    } catch (err) {
      setError('❌ Chyba při načítání moderátorů.');
    }
  };

  useEffect(() => {
    fetchModerators();
  }, []);

  const createModerator = async () => {
    const token = sessionStorage.getItem('adminToken');
    if (!token) return;

    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/api/auth/create-moderator`,
        { email, password },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setMessage(`✅ Moderátor vytvořen: ${res.data.email}`);
      setEmail('');
      setPassword('');
      fetchModerators();
    } catch (err: any) {
      setMessage(err.response?.data?.error || '❌ Chyba při vytváření.');
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    const token = sessionStorage.getItem('adminToken');
    try {
      await axios.patch(
        `${import.meta.env.VITE_API_BASE_URL}/api/admin/moderators/${id}`,
        { active: !current },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchModerators();
    } catch {
      alert('❌ Chyba při změně stavu moderátora.');
    }
  };

  if (moderators === null && !error) {
    return (
      <Container sx={{ mt: 8 }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Typography variant="h4" gutterBottom>Moderátoři</Typography>

      {message && <Alert severity="info" sx={{ mb: 2 }}>{message}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}

      {/* ✅ Create new moderator */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6">Vytvořit nového moderátora</Typography>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
          />
          <TextField
            label="Heslo"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
          />
          <Button variant="contained" onClick={createModerator}>
            Vytvořit
          </Button>
        </Stack>
      </Box>

      {/* ✅ List of moderators */}
      {moderators && moderators.length === 0 && (
        <Typography>Žádní moderátoři nejsou vytvořeni.</Typography>
      )}

      {moderators?.map((mod) => (
        <Card key={mod.id} sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle2">
              Vytvořen: {new Date(mod.createdAt).toLocaleString('cs-CZ')}
            </Typography>
            <TextField
              fullWidth
              label="Email"
              value={mod.email}
              disabled
              sx={{ my: 1 }}
            />
            <Box display="flex" justifyContent="space-between">
              <Button
                variant="outlined"
                onClick={() => toggleActive(mod.id, mod.active)}
              >
                {mod.active ? 'Deaktivovat' : 'Aktivovat'}
              </Button>
              <Typography
                variant="body2"
                color={mod.active ? 'success.main' : 'text.secondary'}
              >
                {mod.active ? '🟢 Aktivní' : '⚪ Neaktivní'}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ))}
    </Container>
  );
}