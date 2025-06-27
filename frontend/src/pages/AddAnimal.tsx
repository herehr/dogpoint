import React, { useState } from 'react';
import {
  Box,
  Button,
  Container,
  TextField,
  Typography,
  Grid
} from '@mui/material';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import UploadFileIcon from '@mui/icons-material/UploadFile';

const AddAnimal: React.FC = () => {
  const navigate = useNavigate();
  const [media, setMedia] = useState<File[]>([]);
  const [preview, setPreview] = useState<string[]>([]);
  const [form, setForm] = useState({ name: '', species: '', age: '', description: '' });

  const handleFileSelection = (files: FileList | File[]) => {
    const selected = Array.from(files);
    setMedia((prev) => [...prev, ...selected]);
    setPreview((prev) => [...prev, ...selected.map((f) => URL.createObjectURL(f))]);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleFileSelection(e.dataTransfer.files);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    const token = sessionStorage.getItem('moderatorToken');
    if (!token) {
      alert('❌ Moderator token missing. Please log in.');
      return;
    }

    try {
      const uploaded: { url: string; type: string }[] = [];

      for (const file of media) {
        console.log('📤 Uploading file:', file.name, file.type);

        const formData = new FormData();
        formData.append('file', file);

        const uploadRes = await axios.post(
          `${import.meta.env.VITE_API_BASE_URL}/api/upload`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const url = uploadRes.data?.url;
        if (!url) {
          console.error('❌ Upload response missing URL:', uploadRes.data);
          continue;
        }

        console.log('✅ Uploaded to:', url);

        uploaded.push({
          url,
          type: file.type.startsWith('video') ? 'video' : 'image',
        });
      }

      console.log('🧪 Final uploaded array:', uploaded);

      const res = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/api/animals`,
        {
          ...form,
          age: Number(form.age),
          galerie: uploaded,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      console.log('✅ Animal created:', res.data);
      navigate('/moderator');
    } catch (err) {
      console.error('❌ Chyba při nahrávání:', err);
    }
  };

  return (
    <Container sx={{ py: 6 }}>
      <Typography variant="h4" gutterBottom>
        Přidat zvíře
      </Typography>

      <Box
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        sx={{ border: '2px dashed #ccc', p: 3, textAlign: 'center', mb: 3 }}
      >
        <UploadFileIcon fontSize="large" />
        <Typography>
          Přetáhněte sem soubory nebo klikněte pro výběr (foto / video)
        </Typography>
        <input
          id="fileInput"
          type="file"
          accept="image/*,video/*"
          multiple
          hidden
          onChange={(e) => e.target.files && handleFileSelection(e.target.files)}
          capture="environment"
        />
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {preview.map((url, index) => (
          <Grid item xs={4} key={index}>
            {url.match(/video/) ? (
              <video src={url} width="100%" controls />
            ) : (
              <img src={url} alt={`media-${index}`} width="100%" />
            )}
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField fullWidth label="Jméno" name="name" value={form.name} onChange={handleChange} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField fullWidth label="Druh" name="species" value={form.species} onChange={handleChange} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField fullWidth type="number" label="Věk" name="age" value={form.age} onChange={handleChange} />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Popis"
            name="description"
            value={form.description}
            onChange={handleChange}
          />
        </Grid>
      </Grid>

      <Button variant="contained" sx={{ mt: 3 }} onClick={handleSubmit}>
        Uložit
      </Button>
    </Container>
  );
};

export default AddAnimal;