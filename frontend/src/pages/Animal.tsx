import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Container,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Button,
  CircularProgress
} from '@mui/material';

interface Animal {
  id: string;
  name: string;
  species: string;
  age: number;
  description: string;
  galerie?: { url: string; type: string }[];
}

const AnimalPage: React.FC = () => {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get(`${import.meta.env.VITE_API_BASE_URL}/api/animals?all=true`)
      .then(res => {
        setAnimals(res.data);
      })
      .catch(err => {
        console.error('❌ Error loading animals:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Naši mazlíčci k adopci
      </Typography>

      {loading ? (
        <CircularProgress />
      ) : (
        <Grid container spacing={4}>
          {animals.map(animal => {
            const imageUrl =
              animal.galerie?.find(g => g.type === 'image')?.url ||
              'https://via.placeholder.com/400x300?text=Bez+obrázku';

            return (
              <Grid item key={animal.id} xs={12} sm={6} md={4}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: '0.3s',
                    '&:hover': { boxShadow: 6, transform: 'scale(1.01)' },
                  }}
                >
                  <CardMedia
                    component="img"
                    height="200"
                    image={imageUrl}
                    alt={animal.name}
                    sx={{ objectFit: 'cover' }}
                  />
                  <CardContent>
                    <Typography gutterBottom variant="h5" component="div">
                      {animal.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Druh: {animal.species} | Věk: {animal.age} let
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1, minHeight: 60 }}>
                      {animal.description}
                    </Typography>
                  </CardContent>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={() => navigate(`/zvire/${animal.id}`)}
                    sx={{ borderTop: '1px solid #eee' }}
                  >
                    Chci adoptovat
                  </Button>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Container>
  );
};

export default AnimalPage;