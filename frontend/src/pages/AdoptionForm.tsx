import React, { useEffect, useState } from 'react';
import {
  Container,
  Typography,
  TextField,
  Button,
  Grid,
  ToggleButton,
  ToggleButtonGroup,
  Box,
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
  galerie?: GalerieMedia[];
}

const AdoptionForm: React.FC = () => {
  const { animalId } = useParams<{ animalId: string }>();
  const navigate = useNavigate();
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [amount, setAmount] = useState<number | 'custom'>(200);
  const [customAmount, setCustomAmount] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '' });

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE_URL}/api/animals/${animalId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Zvíře nebylo nalezeno.');
        return res.json();
      })
      .then((data) => setAnimal(data))
      .catch((err) => {
        console.error('❌ Chyba při načítání zvířete:', err);
        setError('Zvíře nebylo nalezeno.');
      })
      .finally(() => setLoading(false));
  }, [animalId]);

  const handleSubmit = () => {
    const selectedAmount = amount === 'custom' ? Number(customAmount) : amount;

    if (!form.name || !form.email || !selectedAmount || selectedAmount <= 0) {
      alert('Prosím vyplňte všechna povinná pole a částku.');
      return;
    }

    console.log('📤 Odesílám adopci:', {
      ...form,
      amount: selectedAmount,
      animalId,
    });

    // TODO: Send to payment gateway or API
    navigate(`/dekujeme/${animalId}`);
  };

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
        Adoptovat {animal.name}
      </Typography>

      <Box sx={{ my: 3 }}>
        <img
          src={
            animal.galerie?.find((m) => m.type === 'image')?.url ||
            'https://via.placeholder.com/500x300?text=Bez+obrázku'
          }
          alt={animal.name}
          style={{
            width: '100%',
            maxHeight: 300,
            objectFit: 'cover',
            borderRadius: 8,
          }}
        />
      </Box>

      <Typography variant="h6" gutterBottom>Základní údaje</Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Jméno"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Telefon (nepovinné)"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </Grid>
      </Grid>

      <Typography variant="h6" gutterBottom>Měsíční příspěvek</Typography>
      <ToggleButtonGroup
        value={amount}
        exclusive
        onChange={(_, val) => setAmount(val)}
        sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}
      >
        <ToggleButton value={200}>200 Kč</ToggleButton>
        <ToggleButton value={400}>400 Kč</ToggleButton>
        <ToggleButton value={'custom'}>Jiná částka</ToggleButton>
      </ToggleButtonGroup>

      {amount === 'custom' && (
        <TextField
          fullWidth
          type="number"
          label="Zadejte částku"
          value={customAmount}
          onChange={(e) => setCustomAmount(e.target.value)}
          sx={{ mb: 2 }}
        />
      )}

      <Button
        variant="contained"
        size="large"
        fullWidth
        onClick={handleSubmit}
      >
        Pokračovat k platbě
      </Button>
    </Container>
  );
};

export default AdoptionForm;