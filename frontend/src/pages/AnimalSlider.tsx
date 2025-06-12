import React, { useEffect, useState } from 'react';
import Slider from 'react-slick';
import { Card, CardContent, CardMedia, Typography, Box, CircularProgress } from '@mui/material';

interface Animal {
  id: number;
  name: string;
  description: string;
  imageUrl: string;
}

const AnimalSlider: React.FC = () => {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/animals')
      .then((res) => res.json())
      .then((data) => {
        console.log('Fetched animals:', data);
        setAnimals(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching animals:', err);
        setLoading(false);
      });
  }, []);

  const settings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: Math.min(animals.length, 3),
    slidesToScroll: 1,
    responsive: [
      { breakpoint: 900, settings: { slidesToShow: 2 } },
      { breakpoint: 600, settings: { slidesToShow: 1 } },
    ],
  };

  if (loading) return <CircularProgress sx={{ display: 'block', mx: 'auto', my: 4 }} />;

  if (animals.length === 0) return <Typography align="center" sx={{ my: 4 }}>Žádní aktivní mazlíčci k adopci.</Typography>;

  return (
    <Box sx={{ px: 4, py: 6 }}>
      <Typography variant="h5" gutterBottom>
        Naši mazlíčci k adopci
      </Typography>
      <Slider {...settings}>
        {animals.map((animal) => (
          <Box key={animal.id} sx={{ px: 2 }}>
            <Card>
              <CardMedia
                component="img"
                height="200"
                image={animal.imageUrl}
                alt={animal.name}
              />
              <CardContent>
                <Typography variant="h6">{animal.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {animal.description}
                </Typography>
              </CardContent>
            </Card>
          </Box>
        ))}
      </Slider>
    </Box>
  );
};

export default AnimalSlider;