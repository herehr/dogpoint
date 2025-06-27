import { useEffect, useState } from 'react';
import axios from 'axios';
import { Button, Card, CardContent, Typography, CircularProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';

interface Moderator {
  id: string;
  name: string;
  email: string;
}

export default function ModeratorsPage() {
  const [moderators, setModerators] = useState<Moderator[] | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get('/api/moderators', { withCredentials: true })
      .then((res) => setModerators(res.data))
      .catch(() => alert('Unauthorized or server error.'));
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Opravdu chcete tohoto moderátora smazat?')) return;
    await axios.delete(`/api/moderators/${id}`, { withCredentials: true });
    setModerators((prev) => prev!.filter((m) => m.id !== id));
  };

  if (!moderators) {
    return <CircularProgress />;
  }

  return (
    <div className="p-4 space-y-4">
      <Typography variant="h4">Moderátoři</Typography>
      {moderators.map((m) => (
        <Card key={m.id}>
          <CardContent>
            <Typography variant="h6">{m.name}</Typography>
            <Typography variant="body2">{m.email}</Typography>
            <div className="mt-2 space-x-2">
              <Button
                variant="contained"
                color="primary"
                onClick={() => navigate(`/admin/moderator/${m.id}`)}
              >
                Upravit
              </Button>
              <Button variant="outlined" color="error" onClick={() => handleDelete(m.id)}>
                Smazat
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}