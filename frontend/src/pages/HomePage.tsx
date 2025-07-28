import React, { useEffect, useState } from 'react';
import {
  Container,
  Typography,
  Button,
  Box,
  CircularProgress
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

interface GalerieMedia {
  url: string;
  type: string;
}

interface Animal {
  id: string;
  name: string;
  isActive: boolean;
  galerie?: GalerieMedia[];
}

const HomePage: React.FC = () => {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

 useEffect(() => {
  const url = `${import.meta.env.VITE_API_BASE_URL}/api/animals?all=true`;
  console.log('🌐 Fetching animals from:', url); // 👈 Add this

  fetch(url)
    .then((res) => res.json())
    .then((data) => {
      console.log('✅ Animals fetched:', data); // 👈 Add this
      const active = data.filter((a: Animal) => a.isActive).slice(0, 5);
      setAnimals(active);
    })
    .catch((err) => {
      console.error('❌ Failed to load homepage animals:', err); // Already here
    })
    .finally(() => setLoading(false));
}, []);

  return (
    <Container sx={{ py: 6 }}>
      <Typography variant="h3" align="center" gutterBottom>
        Pomozte najít nový domov
      </Typography>
      <Typography variant="h6" align="center" sx={{ mb: 4 }}>
        Vyberte si mazlíčka k adopci z našeho útulku
      </Typography>

      {loading ? (
        <Box textAlign="center">
          <CircularProgress />
        </Box>
      ) : (
        <Box
          sx={{
            display: 'flex',
            overflowX: 'auto',
            gap: 2,
            mb: 4,
            px: 1,
            scrollSnapType: 'x mandatory',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          {animals.map((a) => {
            const image =
              a.galerie?.find((m) => m.type === 'image')?.url ||
              'https://via.placeholder.com/400x300?text=Bez+obrázku';

            return (
              <Box
                key={a.id}
                onClick={() => navigate(`/zvire/${a.id}`)}
                sx={{
                  minWidth: 250,
                  flex: '0 0 auto',
                  scrollSnapAlign: 'start',
                  cursor: 'pointer',
                  borderRadius: 2,
                  overflow: 'hidden',
                  boxShadow: 3,
                  backgroundColor: '#fff',
                  transition: 'transform 0.2s ease-in-out',
                  '&:hover': { transform: 'scale(1.02)' },
                }}
              >
                <Box
                  component="img"
                  src={image}
                  alt={`Zvíře ${a.name}`}
                  sx={{ width: '100%', height: 200, objectFit: 'cover' }}
                />
                <Box sx={{ p: 2 }}>
                  <Typography variant="subtitle1" align="center">
                    {a.name}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      <Box textAlign="center">
        <Button
          variant="contained"
          size="large"
          onClick={() => navigate('/zvirata')}
        >
          Prohlédnout všechna zvířata
        </Button>
      </Box>
    </Container>
  );
};

export default HomePage;