// frontend/src/sections/AnimalTeasers.tsx
import React from 'react';
import {
  Box, Button, Card, CardActions, CardContent, CardMedia,
  Container, Grid, Skeleton, Stack, Typography
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { getJSON } from '../api';
import type { Animal } from '../types/animal';

const FALLBACK_IMG = '/no-image.jpg';
const SPACE_CDN = 'https://dogpoint.fra1.digitaloceanspaces.com'; // used only if server sends S3 key without full URL

function mediaUrl(a: Animal): string {
  const first = a.galerie?.find(g => g.type !== 'video') || a.galerie?.[0];
  if (!first) return FALLBACK_IMG;
  if (first.url) return first.url;
  if (first.key) return `${SPACE_CDN.replace(/\/$/, '')}/${first.key.replace(/^\//, '')}`;
  return FALLBACK_IMG;
}

function displayName(a: Animal): string {
  return (a.jmeno || a.name || 'Zvíře').toUpperCase();
}
function displayText(a: Animal): string {
  return a.popis || a.description || 'Zobrazit detail zvířete a podat adopci.';
}

export default function AnimalTeasers() {
  const [items, setItems] = React.useState<Animal[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    getJSON<Animal[]>('/api/animals?limit=3&active=true')
      .then((data) => {
        if (alive) setItems(data);
      })
      .catch((e) => {
        console.error(e);
        if (alive) {
          setError('Nepodařilo se načíst zvířata.');
          setItems([]); // render nothing instead of static placeholders
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  const loading = items === null;

  return (
    <Box sx={{ py: { xs: 6, md: 8 }, background: 'linear-gradient(180deg, #fff 0%, #F4FEFE 100%)' }}>
      <Container>
        <Grid container spacing={2}>
          {loading &&
            [0, 1, 2].map((i) => (
              <Grid item xs={12} md={4} key={i}>
                <Card variant="outlined">
                  <Skeleton variant="rectangular" height={220} />
                  <CardContent>
                    <Skeleton width="60%" />
                    <Skeleton width="80%" />
                    <Skeleton />
                  </CardContent>
                  <CardActions sx={{ px: 2, pb: 2 }}>
                    <Skeleton variant="rectangular" width="100%" height={36} />
                  </CardActions>
                </Card>
              </Grid>
            ))}

          {!loading && items?.map((a) => (
            <Grid item xs={12} md={4} key={a.id}>
              <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardMedia component="img" height="220" image={mediaUrl(a)} alt={displayName(a)} />
                <CardContent sx={{ flexGrow: 1 }}>
                  <Stack gap={0.5}>
                    <Typography variant="h6" sx={{ fontWeight: 900 }}>
                      {displayName(a)}
                    </Typography>
                    <Typography sx={{ color: 'secondary.main', fontWeight: 700, fontSize: 14 }}>
                      {/* optional short line from description */}
                      {(displayText(a) || '').slice(0, 70)}{(displayText(a) || '').length > 70 ? '…' : ''}
                    </Typography>
                    <Typography color="text.secondary">{displayText(a)}</Typography>
                  </Stack>
                </CardContent>
                <CardActions sx={{ px: 2, pb: 2 }}>
                  <Button component={RouterLink} to={`/zvirata/${a.id}`} variant="contained" fullWidth>
                    Mám zájem
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}

          {!loading && items?.length === 0 && (
            <Grid item xs={12}>
              <Typography color="text.secondary">{error || 'Žádná zvířata k zobrazení.'}</Typography>
            </Grid>
          )}
        </Grid>
      </Container>
    </Box>
  );
}