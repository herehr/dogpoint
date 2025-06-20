import React, { useEffect, useState } from 'react';
import AnimalCard from '../components/AnimalCard';
import {
  Box,
  Typography,
  Grid,
  CircularProgress,
  Alert,
} from '@mui/material';

interface Animal {
  id: string;
  name: string;
  description: string;
  species?: string;
  age?: number;
  galerie?: { url: string; type: string }[];
}

const AnimalsPage: React.FC = () => {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = `${import.meta.env.VITE_API_BASE_URL}/api/animals?all=true`;
    console.log('📡 Fetching animals from:', url);

    fetch(url)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Chyba při načítání dat');
        }
        return res.json();
      })
      .then((data) => {
        console.log('🐾 API response:', data);
        if (Array.isArray(data)) {
          setAnimals(data);
        } else if (Array.isArray(data.animals)) {
          setAnimals(data.animals);
        } else {
          throw new Error('Neočekávaný formát dat');
        }
      })
      .catch((error) => {
        console.error('❌ Chyba při načítání zvířat:', error);
        setError('Nepodařilo se načíst seznam zvířat.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" gutterBottom>
        Naši psi k adopci
      </Typography>

      {loading && <CircularProgress />}

      {error && <Alert severity="error">{error}</Alert>}

      {!loading && !error && (
        <Grid container spacing={3}>
          {Array.isArray(animals) && animals.map((animal) => {
            const media = animal.galerie?.find((g) => g.type === 'image');
            const imageUrl =
              media?.url ||
              'https://via.placeholder.com/400x300?text=Bez+obrázku';

            return (
              <Grid item key={animal.id} xs={12} sm={6} md={4}>
                <AnimalCard
                  id={animal.id}
                  name={animal.name}
                  description={animal.description}
                  imageUrl={imageUrl}
                  species={animal.species}
                  age={animal.age}
                />
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
};

export default AnimalsPage;