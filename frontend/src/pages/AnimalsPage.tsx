import React, { useEffect, useState } from 'react';
import AnimalCard from '../components/AnimalCard';
import {
  Box,
  Typography,
  Grid,
  CircularProgress,
  Alert
} from '@mui/material';

interface Animal {
  id: string;
  name: string;
  description: string;
  galerie?: { url: string; type: string }[];
}

const AnimalsPage: React.FC = () => {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE_URL}/api/animals?all=true`)
      .then((res) => {
        if (!res.ok) throw new Error('Chyba při načítání dat');
        return res.json();
      })
      .then((data) => setAnimals(data))
      .catch((error) => {
        console.error('❌ Chyba při načítání zvířat:', error);
        setError('Nepodařilo se načíst seznam zvířat.');
      })
      .finally(() => setLoading(false));
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
          {animals.map((animal) => {
            const media = animal.galerie?.find(g => g.type === 'image');
            return (
              <Grid item key={animal.id} xs={12} sm={6} md={4}>
                <AnimalCard
                  id={animal.id}
                  name={animal.name}
                  description={animal.description}
                  imageUrl={media?.url}
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