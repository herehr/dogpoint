import React, { useEffect, useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  Tabs,
  Tab,
  Grid,
  CircularProgress,
  Alert
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';

interface GalerieMedia {
  url: string;
  type: 'image' | 'video';
}

interface Animal {
  id: string;
  name: string;
  age: number;
  species: string;
  description: string;
  galerie?: GalerieMedia[];
}

const AnimalDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE_URL}/api/animals/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Chyba při načítání detailu.');
        return res.json();
      })
      .then((data) => setAnimal(data))
      .catch((err) => {
        console.error('❌ Chyba při načítání zvířete:', err);
        setError('Zvíře nebylo nalezeno.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <Container sx={{ py: 4 }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error || !animal) {
    return (
      <Container sx={{ py: 4 }}>
        <Alert severity="error">{error || 'Zvíře nebylo nalezeno.'}</Alert>
      </Container>
    );
  }

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        {animal.name}
      </Typography>
      <Typography variant="subtitle1" gutterBottom>
        Druh: {animal.species} | Věk: {animal.age} let
      </Typography>
      <Typography variant="body1" sx={{ mb: 4 }}>
        {animal.description}
      </Typography>

      <Tabs value={tab} onChange={(_, newValue) => setTab(newValue)} sx={{ mb: 2 }}>
        <Tab label="Galerie" />
        <Tab label="Aktualizace" />
      </Tabs>

      {tab === 0 && (
        <Grid container spacing={2}>
          {animal.galerie?.map((media, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              {media.type === 'image' ? (
                <Box
                  component="img"
                  src={media.url}
                  alt={`media-${index}`}
                  sx={{ width: '100%', borderRadius: 2 }}
                />
              ) : (
                <Box component="video" controls src={media.url} sx={{ width: '100%', borderRadius: 2 }} />
              )}
            </Grid>
          ))}
        </Grid>
      )}

      {tab === 1 && (
        <Typography variant="body2" color="text.secondary">
          Zde budou aktualizace (např. příběhy, komentáře).
        </Typography>
      )}

      <Box sx={{ mt: 4 }}>
        <Button variant="contained" onClick={() => navigate(-1)}>
          Zpět
        </Button>
      </Box>
    </Container>
  );
};

export default AnimalDetail;