import React, { useState } from 'react';
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

const AddPost: React.FC = () => {
  const { id } = useParams(); // animalId
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(`${import.meta.env.VITE_API_BASE_URL}/posts`, {
        animalId: id,
        content,
        media: mediaUrl ? [mediaUrl] : []
      });
      alert('Příspěvek byl přidán.');
    } catch (err) {
      console.error(err);
      alert('Chyba při přidávání příspěvku.');
    }
  };

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>Přidat Příspěvek</Typography>
      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          <TextField
            label="Text příspěvku"
            multiline
            minRows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            fullWidth
            required
          />
          <TextField
            label="URL fotografie nebo videa (volitelně)"
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
            fullWidth
          />
          <Button type="submit" variant="contained">Odeslat</Button>
        </Stack>
      </Box>
    </Container>
  );
};

export default AddPost;
