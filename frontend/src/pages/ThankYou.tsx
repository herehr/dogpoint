import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Container, Typography, Button, Card, CardMedia, CardContent } from '@mui/material';

interface Animal {
  id: string;
  name: string;
  species: string;
  age: number;
  description: string;
  photos: string[];
}

const dummyUserId = 'user-123';

const ThankYou: React.FC = () => {
  const { animalId } = useParams();
  const [animal, setAnimal] = useState<Animal | null>(null);

  useEffect(() => {
    axios.get(`${import.meta.env.VITE_API_BASE_URL}/animals/${animalId}`)
      .then(res => setAnimal(res.data))
      .catch(() => setAnimal(null));

    // Simulate unlocking content by marking this animal as adopted by dummy user
    axios.post(`${import.meta.env.VITE_API_BASE_URL}/adopt`, {
      email: 'dummy@user.cz',
      name: 'Dummy User',
      amount: 100,
      animalId: animalId,
      userId: dummyUserId,
      test: true
    }).catch(err => console.error('Dummy adoption failed', err));
  }, [animalId]);

  return (
    <Container sx={{ py: 6, textAlign: 'center' }}>
      <Typography variant="h3" gutterBottom>
        Děkujeme za adopci!
      </Typography>
      <Typography variant="h6" sx={{ mb: 4 }}>
        Vaše podpora opravdu mění život. Nyní jste hrdým adoptivním rodičem.
      </Typography>

      {animal && (
        <Card sx={{ maxWidth: 500, margin: '0 auto' }}>
          <CardMedia
            component="img"
            height="250"
            image={animal.photos[0] || 'https://via.placeholder.com/500x300'}
            alt={animal.name}
          />
          <CardContent>
            <Typography variant="h5">{animal.name}</Typography>
            <Typography variant="body2">{animal.species}, {animal.age} let</Typography>
            <Typography variant="body1" sx={{ mt: 2 }}>{animal.description}</Typography>
          </CardContent>
        </Card>
      )}

      <Button variant="contained" sx={{ mt: 4 }} component={Link} to="/zvirata">
        Zpět na přehled mazlíčků
      </Button>
    </Container>
  );
};

export default ThankYou;
