import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  TextField,
  Typography,
  MenuItem,
  Select,
  InputLabel,
  FormControl
} from '@mui/material';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

interface Animal {
  id: string;
  name: string;
  species: string;
  age: number;
  description: string;
  isActive: boolean;
  galerie?: { url: string; type: string }[];
}

const AnimalList: React.FC = () => {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [search, setSearch] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState('');
  const [ageFilter, setAgeFilter] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get(`${import.meta.env.VITE_API_BASE_URL}/api/animals?all=true`)
      .then((res) => setAnimals(res.data))
      .catch((err) => console.error('❌ Error loading animals:', err));
  }, []);

  const filtered = animals.filter((a) =>
    a.isActive &&
    a.name.toLowerCase().includes(search.toLowerCase()) &&
    (!speciesFilter || a.species === speciesFilter) &&
    (!ageFilter || a.age.toString() === ageFilter)
  );

  const uniqueSpecies = Array.from(new Set(animals.map((a) => a.species))).filter(Boolean);
  const uniqueAges = Array.from(new Set(animals.map((a) => a.age.toString()))).filter(Boolean);

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Zvířata k adopci
      </Typography>

      {/* Filters */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
        <TextField
          label="Hledat podle jména"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          fullWidth
        />

        <FormControl fullWidth>
          <InputLabel>Druh</InputLabel>
          <Select
            value={speciesFilter}
            onChange={(e) => setSpeciesFilter(e.target.value)}
            label="Druh"
          >
            <MenuItem value="">Vše</MenuItem>
            {uniqueSpecies.map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth>
          <InputLabel>Věk</InputLabel>
          <Select
            value={ageFilter}
            onChange={(e) => setAgeFilter(e.target.value)}
            label="Věk"
          >
            <MenuItem value="">Vše</MenuItem>
            {uniqueAges.map((a) => (
              <MenuItem key={a} value={a}>
                {a} let
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Animal Cards */}
      <Grid container spacing={3}>
        {filtered.map((animal) => {
          const media = animal.galerie?.[0];
          const isImage = media?.type === 'image';
          const src = media?.url?.startsWith('http')
            ? media.url
            : 'https://via.placeholder.com/400x200?text=Bez+obrázku';

          return (
            <Grid item xs={12} sm={6} md={4} key={animal.id}>
              <Card
                onClick={() => navigate(`/zvire/${animal.id}`)}
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  transition: '0.3s',
                  '&:hover': { boxShadow: 6 },
                }}
              >
                {isImage ? (
                  <Box
                    component="img"
                    src={src}
                    alt={animal.name}
                    sx={{
                      width: '100%',
                      height: 200,
                      objectFit: 'cover',
                    }}
                  />
                ) : media?.type === 'video' ? (
                  <video
                    src={src}
                    controls
                    style={{
                      width: '100%',
                      height: 200,
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <Box
                    component="img"
                    src="https://via.placeholder.com/400x200?text=Bez+obrázku"
                    alt="placeholder"
                    sx={{
                      width: '100%',
                      height: 200,
                      objectFit: 'cover',
                      opacity: 0.5,
                    }}
                  />
                )}

                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {animal.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {animal.species} • {animal.age} let
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {animal.description.length > 100
                      ? `${animal.description.slice(0, 100)}…`
                      : animal.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Container>
  );
};

export default AnimalList;