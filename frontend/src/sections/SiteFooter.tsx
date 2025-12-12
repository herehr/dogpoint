// frontend/src/sections/SiteFooter.tsx
import React from 'react'
import {
  Box,
  Container,
  Link,
  Stack,
  Typography,
} from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

export default function SiteFooter() {
  return (
    <Box sx={{ bgcolor: 'brand.dark', color: 'white', py: 5 }}>
      <Container>
        <Stack gap={2}>
          {/* Title */}
          <Typography variant="h6" sx={{ fontWeight: 900 }}>
            DOGPOINT
          </Typography>

          {/* Contacts */}
          <Stack gap={0.5}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              Kontakty
            </Typography>
            <Typography variant="body2">
              Telefon:{' '}
              <Link
                href="tel:+420607018218"
                color="inherit"
                underline="hover"
              >
                +420 607 018 218
              </Link>
            </Typography>
            <Typography variant="body2">
              E-mail:{' '}
              <Link
                href="mailto:info@dog-point.cz"
                color="inherit"
                underline="hover"
              >
                info@dog-point.cz
              </Link>
            </Typography>
          </Stack>

          {/* Shelter address */}
          <Stack gap={0.5}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              Adresa útulku
            </Typography>
            <Typography variant="body2">
              Lhotky 60
              <br />
              281 63 Malotice
            </Typography>
          </Stack>

          {/* Organization address */}
          <Stack gap={0.5}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              Sídlo organizace a korespondenční kontakt
            </Typography>
            <Typography variant="body2">
              Dogpoint o.p.s.
              <br />
              Milánská 452
              <br />
              109 00 Praha 15
            </Typography>
            <Typography variant="body2">
              ID Datové schránky: fkb79bk
              <br />
              IČO: 22887253
              <br />
              Spisová značka: O 1478
              <br />
              vedená u Městského soudu v Praze
            </Typography>
          </Stack>

          {/* Social */}
          <Stack gap={0.5}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              Sledujte nás
            </Typography>
            <Stack direction="row" gap={2} flexWrap="wrap">
              <Link
                href="https://www.tiktok.com/@utulek_dogpoint"
                target="_blank"
                rel="noopener noreferrer"
                color="inherit"
                underline="hover"
              >
                TikTok
              </Link>
              <Link
                href="https://www.instagram.com/utulek_dogpoint/?hl=cs"
                target="_blank"
                rel="noopener noreferrer"
                color="inherit"
                underline="hover"
              >
                Instagram
              </Link>
              <Link
                href="https://www.facebook.com/Dogpoint/?locale=cs_CZ"
                target="_blank"
                rel="noopener noreferrer"
                color="inherit"
                underline="hover"
              >
                Facebook
              </Link>
              <Link
                href="https://www.youtube.com/channel/UC_rdqxvvUhWZuqk-_h-5rBQ"
                target="_blank"
                rel="noopener noreferrer"
                color="inherit"
                underline="hover"
              >
                YouTube
              </Link>
            </Stack>
          </Stack>

          {/* Footer bottom */}
          <Typography variant="caption" sx={{ opacity: 0.7, pt: 2 }}>
            © {new Date().getFullYear()} Dogpoint o. p. s. •{' '}
            <Link
              component={RouterLink}
              to="/ochrana-osobnich-udaju"
              color="inherit"
              sx={{ textDecoration: 'underline' }}
            >
              Ochrana osobních údajů
            </Link>
          </Typography>
        </Stack>
      </Container>
    </Box>
  )
}