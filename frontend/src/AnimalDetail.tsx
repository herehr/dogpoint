import { useParams } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";

interface Animal {
  id: string;
  jmeno: string;
  popis: string;
  galerie: { url: string; type: "image" | "video" }[];
  aktualizace: { id: string; text: string; datum: string }[];
}

export default function AnimalDetail() {
  const { id } = useParams();
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch(`/api/animals/${id}`);
      const data = await res.json();
      setAnimal(data);
    };
    fetchData();
  }, [id]);

  if (!animal) return <Typography>Načítání…</Typography>;

  return (
    <Container sx={{ pt: 4 }}>
      <Typography variant="h3" gutterBottom>{animal.jmeno}</Typography>

      {/* Galerie */}
      <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', mb: 3 }}>
        {animal.galerie.map((media, idx) => (
          <Box key={idx} sx={{ minWidth: 200 }}>
            {media.type === "image" ? (
              <img
                src={media.url}
                alt={`media-${idx}`}
                style={{ width: "100%", borderRadius: 8 }}
              />
            ) : (
              <video
                controls
                style={{ width: "100%", borderRadius: 8 }}
                src={media.url}
              />
            )}
          </Box>
        ))}
      </Box>

      {/* Darovací tlačítko */}
      <Box sx={{ textAlign: "center", mb: 4 }}>
        <Button variant="contained" color="primary" size="large">
          Chci pomoci – měsíční adopce
        </Button>
      </Box>

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, val) => setTab(val)} centered>
        <Tab label="Informace" />
        <Tab label="Aktualizace" />
      </Tabs>

      {/* Obsah tabů */}
      <Box mt={3}>
        {tab === 0 && (
          <Typography variant="body1">{animal.popis}</Typography>
        )}

        {tab === 1 && (
          <Box>
            {animal.aktualizace.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Zatím žádné aktualizace.
              </Typography>
            ) : (
              animal.aktualizace.map((akt) => (
                <Card key={akt.id} sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(akt.datum).toLocaleDateString("cs-CZ")}
                    </Typography>
                    <Typography>{akt.text}</Typography>
                  </CardContent>
                </Card>
              ))
            )}
          </Box>
        )}
      </Box>
    </Container>
  );
}