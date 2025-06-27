import React from 'react';
import { Card, CardContent, CardMedia, Typography } from '@mui/material';

interface AnimalCardProps {
  name: string;
  description: string;
  imageUrl: string;
}

const AnimalCard: React.FC<AnimalCardProps> = ({ name, description, imageUrl }) => {
  return (
    <Card sx={{ maxWidth: 300, m: 2, borderRadius: 2, boxShadow: 3 }}>
      <CardMedia
        component="img"
        height="200"
        image={imageUrl}
        alt={`Fotka psa ${name}`}
      />
      <CardContent>
        <Typography variant="h6" component="div">
          {name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </CardContent>
    </Card>
  );
};

export default AnimalCard;