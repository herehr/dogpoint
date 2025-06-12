import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Card,
  CardContent,
  Typography,
  Container,
  CircularProgress,
  TextField,
  Button,
  Box,
  Alert,
} from '@mui/material';

interface Moderator {
  id: string;
  email: string;
  active: boolean;
  createdAt: string;
}

export default function ModeratorList() {
  const [moderators, setModerators] = useState<Moderator[] | null>(null);
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
    } catch (err: any) {
      console.error('❌ Failed to fetch moderators:', err);
      if (err.response?.status === 403) {
        setError('⚠️ Přístup odepřen – nejste přihlášen jako admin.');
      } else {
        setError('❌ Chyba při načítání moderátorů.');
      }
    }
  };

  useEffect(() => {
    fetchModerators();
  }, []);

  const toggleActive = async (id: string, current: boolean) => {
    const token = sessionStorage.getItem('adminToken');
    try {
      await axios.patch(
        `${import.meta.env.VITE_API_BASE_URL}/api/admin/moderators/${id}`,
        { active: !current },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setModerators((prev) =>
        prev ? prev.map((m) => (m.id === id ? { ...m, active: !current } : m)) : null
      );
    } catch {
      alert('❌ Chyba při změně stavu moderátora.');
    }
  };

  const updateEmail = async (id: string, email: string) => {
    const token = sessionStorage.getItem('adminToken');
    try {
      await axios.patch(
        `${import.meta.env.VITE_API_BASE_URL}/api/admin/moderators/${id}`,
        { email },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch {
      alert('❌ Chyba při aktualizaci emailu.');
    }
  };

  const deleteModerator = async (id: string) => {
    const token = sessionStorage.getItem('adminToken');
    if (!confirm('Opravdu chcete smazat tohoto moderátora?')) return;
    try {
      await axios.delete(
        `${import.meta.env.VITE_API_BASE_URL}/api/admin/moderators/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setModerators((prev) => (prev ? prev.filter((m) => m.id !== id) : null));
    } catch {
      alert('❌ Chyba při mazání moderátora.');
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
      <Typography variant="h4" gutterBottom>Seznam moderátorů</Typography>

      {error && <Alert severity="error">{error}</Alert>}

      {moderators && moderators.length === 0 && (
        <Typography>Žádní moderátoři nebyli nalezeni.</Typography>
      )}

      {moderators?.map((mod) => (
        <Card key={mod.id} sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="subtitle2">
              Vytvořen: {new Date(mod.createdAt).toLocaleString('cs-CZ')}
            </Typography>
            <TextField
              fullWidth
              label="Email"
              value={mod.email}
              onChange={(e) => {
                const updated = moderators.map((m) =>
                  m.id === mod.id ? { ...m, email: e.target.value } : m
                );
                setModerators(updated);
              }}
              onBlur={(e) => updateEmail(mod.id, e.target.value)}
              sx={{ my: 1 }}
            />
            <Box display="flex" justifyContent="space-between">
              <Button
                variant="outlined"
                onClick={() => toggleActive(mod.id, mod.active)}
              >
                {mod.active ? 'Deaktivovat' : 'Aktivovat'}
              </Button>
              <Button
                variant="outlined"
                color="error"
                onClick={() => deleteModerator(mod.id)}
              >
                Smazat
              </Button>
            </Box>
          </CardContent>
        </Card>
      ))}
    </Container>
  );
}