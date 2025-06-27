import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import {
  Container,
  Typography,
  TextField,
  Button,
  Stack,
  Box
} from '@mui/material';

const EditAnimal: React.FC = () => {
  const { id } = useParams();
  const [form, setForm] = useState({
    name: '',
    species: '',
    age: '',
    description: '',
    photoUrl: ''
  });

  useEffect(() => {
    axios.get(`${import.meta.env.VITE_API_BASE_URL}/animals/${id}`)
      .then(res => {
        const animal = res.data;
        setForm({
          name: animal.name,
          species: animal.species,
          age: animal.age.toString(),
          description: animal.description,
          photoUrl: animal.photos[0] || ''
        });
      })
      .catch(err => console.error(err));
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.patch(`${import.meta.env.VITE_API_BASE_URL}/animals/${id}`, {
        ...form,
        age: parseInt(form.age),
        photos: [form.photoUrl]
      });
      alert('Změny byly uloženy.');
    } catch (err) {
      console.error(err);
      alert('Chyba při ukládání.');
    }
  };

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>Upravit Zvíře</Typography>
      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          <TextField label="Jméno" name="name" value={form.name} onChange={handleChange} fullWidth required />
          <TextField label="Druh" name="species" value={form.species} onChange={handleChange} fullWidth required />
          <TextField label="Věk" name="age" value={form.age} type="number" onChange={handleChange} fullWidth required />
          <TextField label="Popis" name="description" value={form.description} onChange={handleChange} fullWidth multiline minRows={3} />
          <TextField label="URL fotky" name="photoUrl" value={form.photoUrl} onChange={handleChange} fullWidth />
          <Button type="submit" variant="contained">Uložit</Button>
        </Stack>
      </Box>
    </Container>
  );
};

export default EditAnimal;
