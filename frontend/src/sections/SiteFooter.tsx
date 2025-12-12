// frontend/src/sections/SiteFooter.tsx
import React from 'react'
import {
  Box,
  Container,
  Link,
  Stack,
  Typography,
  Grid,
  Divider,
} from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

export default function SiteFooter() {
  return (
    <Box sx={{ bgcolor: 'brand.dark', color: 'white', py: { xs: 4, md: 6 } }}>
      <Container>
        {/* Top: Title + columns */}
        <Stack gap={{ xs: 3, md: 4 }}>
          <Typography
            variant="h6"
            sx={{ fontWeight: 900, letterSpacing: 0.5 }}
          >
            DOGPOINT
          </Typography>

          <Grid container spacing={{ xs: 3, md: 4 }}>
            {/* Column 1 */}
            <Grid item xs={12} md={4}>
              <Stack gap={1}>
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

                <Typography variant="body2" sx={{ fontWeight: 700, mt: 2 }}>
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
            </Grid>

            {/* Column 2 */}
            <Grid item xs={12} md={4}>
              <Stack gap={1}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  Adresa útulku
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Lhotky 60
                  <br />
                  281 63 Malotice
                </Typography>
              </Stack>
            </Grid>

            {/* Column 3 */}
            <Grid item xs={12} md={4}>
              <Stack gap={1}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  Sídlo organizace a korespondenční kontakt
                </Typography>

                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Dogpoint o.p.s.
                  <br />
                  Milánská 452
                  <br />
                  109 00 Praha 15
                </Typography>

                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  ID Datové schránky: fkb79bk
                  <br />
                  IČO: 22887253
                  <br />
                  Spisová značka: O 1478
                  <br />
                  vedená u Městského soudu v Praze
                </Typography>
              </Stack>
            </Grid>
          </Grid>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)' }} />

          {/* Bottom line */}
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
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