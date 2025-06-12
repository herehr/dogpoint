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
      <Typography variant="h4" gutterBottom>{animal.name}</Typography>
      <Typography variant="subtitle1" gutterBottom>
        Druh: {animal.species} | Věk: {animal.age} let
      </Typography>

      <Box sx={{ my: 2 }}>
        <Button
          variant="contained"
          size="large"
          onClick={() => navigate(`/adopce/${animal.id}`)}
        >
          Chci pomoci / adoptovat
        </Button>
      </Box>

      <Tabs value={tab} onChange={(_, newVal) => setTab(newVal)} sx={{ mb: 2 }}>
        <Tab label="Informace" />
        <Tab label="Galerie" />
        <Tab label="Aktualizace" />
      </Tabs>

      {/* Tab 1: Informace */}
      {tab === 0 && (
        <Box>
          <Typography>{animal.description}</Typography>
        </Box>
      )}

      {/* Tab 2: Galerie */}
      {tab === 1 && (
        <Grid container spacing={2}>
          {animal.galerie?.length ? (
            animal.galerie.map((media, index) => (
              <Grid item xs={6} sm={4} key={index}>
                {media.type === 'image' ? (
                  <Box
                    component="img"
                    src={media.url}
                    alt={`Foto ${animal.name}`}
                    sx={{
                      width: '100%',
                      borderRadius: 2,
                      objectFit: 'cover',
                      height: 200,
                    }}
                  />
                ) : (
                  <video
                    src={media.url}
                    controls
                    style={{
                      width: '100%',
                      borderRadius: 8,
                      objectFit: 'cover',
                      height: 200,
                    }}
                  />
                )}
              </Grid>
            ))
          ) : (
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary">
                Galerie není dostupná.
              </Typography>
            </Grid>
          )}
        </Grid>
      )}

      {/* Tab 3: Aktualizace */}
      {tab === 2 && (
        <Typography>
          Aktualizace tohoto zvířete budou brzy k dispozici.
        </Typography>
      )}
    </Container>
  );
};

export default AnimalDetail;