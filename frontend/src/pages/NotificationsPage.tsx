// frontend/src/pages/NotificationsPage.tsx
import React, { useEffect, useState } from "react";
import {
  Box,
  Container,
  Typography,
  List,
  ListItem,
  ListItemText,
  Button,
} from "@mui/material";
import { useAuth } from "../context/AuthContext";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
};

export default function NotificationsPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const baseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${baseUrl}/api/notifications`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });

      if (!res.ok) {
        console.error("Failed loading notifications", res.status);
        setItems([]);
        return;
      }

      const data = await res.json();
      setItems(data.notifications || []);
    } catch (e) {
      console.error("Failed loading notifications", e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function markRead(id: string) {
    if (!token) return;
    try {
      const res = await fetch(`${baseUrl}/api/notifications/${id}/read`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });

      if (!res.ok) {
        console.error("Failed marking notification as read", res.status);
        return;
      }

      // remove from local list
      setItems((prev) => prev.filter((n) => n.id !== id));
    } catch (e) {
      console.error("Failed marking notification as read", e);
    }
  }

  useEffect(() => {
    if (token) {
      load();
    } else {
      setItems([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <Box sx={{ backgroundColor: "#26E6EA", minHeight: "100vh", py: 4 }}>
      <Container maxWidth="md">
        <Typography variant="h4" fontWeight={700} mb={3}>
          Notifikace
        </Typography>

        {loading && <Typography>Načítám notifikace…</Typography>}

        {!loading && items.length === 0 && (
          <Typography>Nemáte žádné notifikace.</Typography>
        )}

        <List sx={{ mt: 2 }}>
          {items.map((n) => (
            <ListItem
              key={n.id}
              sx={{
                background: "#fff",
                borderRadius: 2,
                mb: 2,
                alignItems: "flex-start",
              }}
            >
              <ListItemText
                primary={
                  <Typography variant="h6" fontWeight={700}>
                    {n.title}
                  </Typography>
                }
                secondary={
                  <>
                    <Typography variant="body2" mt={1}>
                      {n.message}
                    </Typography>
                    <Typography
                      variant="caption"
                      display="block"
                      color="gray"
                      mt={0.5}
                    >
                      {new Date(n.createdAt).toLocaleString("cs-CZ")}
                    </Typography>
                  </>
                }
              />
              <Button
                onClick={() => markRead(n.id)}
                sx={{ ml: 2, whiteSpace: "nowrap" }}
              >
                Smazat
              </Button>
            </ListItem>
          ))}
        </List>
      </Container>
    </Box>
  );
}