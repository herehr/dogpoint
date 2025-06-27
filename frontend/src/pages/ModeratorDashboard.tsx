import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Container,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Grid,
  Box,
  CircularProgress
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

interface Animal {
  id: string;
  name: string;
  species: string;
  age: number;
  description: string;
  isActive: boolean;
  galerie?: { url: string; type: string }[];
}

const ModeratorDashboard: React.FC = () => {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [filter, setFilter] = useState<'all' | 'active'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = sessionStorage.getItem('moderatorToken');
    if (!token) {
      setError('❌ Chybí moderator token. Přihlaste se znovu.');
      setLoading(false);
      return;
    }

    axios
      .get(`${import.meta.env.VITE_API_BASE_URL}/api/animals?all=true`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setAnimals(res.data))
      .catch(() => setError('❌ Chyba při načítání dat.'))
      .finally(() => setLoading(false));
  }, []);

  const handleToggleStatus = async (id: string, current: boolean) => {
    const token = sessionStorage.getItem('moderatorToken');
    try {
      await axios.patch(
        `${import.meta.env.VITE_API_BASE_URL}/api/animals/${id}/status`,
        { isActive: !current },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAnimals((prev) =>
        prev.map((a) => (a.id === id ? { ...a, isActive: !current } : a))
      );
    } catch (err) {
      console.error('❌ Chyba při změně stavu:', err);
    }
  };

  const visibleAnimals = Array.isArray(animals)
    ? animals
        .filter((a) => (filter === 'all' ? true : a.isActive))
        .sort((a, b) => (a.isActive === b.isActive ? 0 : a.isActive ? -1 : 1))
    : [];

  if (loading) {
    return (
      <Container sx={{ py: 4 }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container sx={{ py: 4 }}>
        <Typography color="error">{error}</Typography>
      </Container>
    );
  }

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Moderátorský Panel
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Button
            variant={filter === 'all' ? 'contained' : 'outlined'}
            sx={{ mr: 1 }}
            onClick={() => setFilter('all')}
          >
            Všechny
          </Button>
          <Button
            variant={filter === 'active' ? 'contained' : 'outlined'}
            onClick={() => setFilter('active')}
          >
            Pouze aktivní
          </Button>
        </Box>
        <Button variant="contained" onClick={() => navigate('/moderator/pridat')}>
          Přidat zvíře
        </Button>
      </Box>

      <Grid container spacing={3}>
        {visibleAnimals.map((animal) => (
          <Grid item xs={12} sm={6} md={4} key={animal.id}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                opacity: animal.isActive ? 1 : 0.5,
                border: animal.isActive ? '1px solid #ccc' : '1px dashed #aaa',
                transition: 'all 0.3s ease-in-out',
                '&:hover': {
                  boxShadow: 6,
                  transform: 'scale(1.02)',
                },
              }}
            >
              {animal.galerie?.length ? (
                <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', px: 1, pt: 1 }}>
                  {animal.galerie.map((media, index) =>
                    media.type === 'image' ? (
                      <Box
                        key={index}
                        component="img"
                        src={
                          media.url?.startsWith('http')
                            ? media.url
                            : 'https://via.placeholder.com/400x200?text=Chybný+obrázek'
                        }
                        alt={`media-${index}`}
                        onError={(e) =>
                          (e.currentTarget.src =
                            'https://via.placeholder.com/400x200?text=Obrázek+nenalezen')
                        }
                        sx={{ height: 100, borderRadius: 1, objectFit: 'cover' }}
                      />
                    ) : (
                      <Box key={index} sx={{ height: 100 }}>
                        <video
                          src={media.url?.startsWith('http') ? media.url : undefined}
                          controls
                          onError={(e) =>
                            (e.currentTarget.poster =
                              'https://via.placeholder.com/400x200?text=Chyba+ve+videu')
                          }
                          style={{ height: '100%', borderRadius: 8, backgroundColor: '#000' }}
                        />
                      </Box>
                    )
                  )}
                </Box>
              ) : (
                <Box
                  component="img"
                  src="https://via.placeholder.com/400x200?text=Bez+obrázku"
                  alt="No media"
                  sx={{
                    width: '100%',
                    height: 200,
                    objectFit: 'cover',
                    borderBottom: '1px solid #eee',
                    opacity: 0.5,
                    borderTopLeftRadius: 8,
                    borderTopRightRadius: 8,
                  }}
                />
              )}

              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {animal.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {animal.species} • {animal.age} let
                </Typography>
                <Typography variant="body2" sx={{ minHeight: '60px' }}>
                  {animal.description}
                </Typography>
              </CardContent>
              <CardActions sx={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <Button size="small" onClick={() => navigate(`/moderator/upravit/${animal.id}`)}>
                  ✏️ Upravit
                </Button>
                <Button size="small" onClick={() => navigate(`/moderator/prispevek/${animal.id}`)}>
                  📰 Příspěvek
                </Button>
                <Button
                  size="small"
                  color={animal.isActive ? 'secondary' : 'success'}
                  onClick={() => handleToggleStatus(animal.id, animal.isActive)}
                >
                  {animal.isActive ? 'Deaktivovat' : 'Aktivovat'}
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
};

export default ModeratorDashboard;