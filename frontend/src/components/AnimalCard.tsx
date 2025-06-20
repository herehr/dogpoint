import React from 'react';
import {
  Card,
  CardMedia,
  CardContent,
  Typography,
  Button,
  Box
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

interface AnimalCardProps {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  species?: string;
  age?: number;
}

const AnimalCard: React.FC<AnimalCardProps> = ({
  id,
  name,
  description,
  imageUrl,
  species,
  age
}) => {
  const navigate = useNavigate();

  const finalImage =
    imageUrl?.startsWith('http')
      ? imageUrl
      : 'https://via.placeholder.com/400x300?text=Bez+obrázku';

  return (
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
        image={finalImage}
        alt={`Fotka zvířete ${name}`}
        sx={{ objectFit: 'cover' }}
      />
      <CardContent sx={{ flexGrow: 1 }}>
        <Typography gutterBottom variant="h6" component="div">
          {name}
        </Typography>
        {species && age !== undefined && (
          <Typography variant="body2" color="text.secondary">
            Druh: {species} | Věk: {age} let
          </Typography>
        )}
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 1, minHeight: 60 }}
        >
          {description.length > 100 ? `${description.slice(0, 100)}…` : description}
        </Typography>
      </CardContent>
      <Box sx={{ px: 2, pb: 2 }}>
        <Button
          variant="contained"
          fullWidth
          onClick={() => navigate(`/zvire/${id}`)}
        >
          Chci adoptovat
        </Button>
      </Box>
    </Card>
  );
};

export default AnimalCard;