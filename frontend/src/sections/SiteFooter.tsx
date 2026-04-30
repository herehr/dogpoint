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
import { clientConfig } from '../config/clientConfig'
import { t } from '../i18n/t'

export default function SiteFooter() {
  const socials = clientConfig.socialLinks
  const showSocials = socials.length > 0

  const col2 = clientConfig.footerAddressOverride || t('footer.column2Body')
  const col3 = clientConfig.footerLegalOverride || t('footer.column3Body')

  const privacyIsExternal = Boolean(clientConfig.legalPrivacyUrl?.trim())
  const impressum = clientConfig.legalImprintUrl?.trim()

  return (
    <Box sx={{ bgcolor: 'brand.dark', color: 'white', py: { xs: 4, md: 6 } }}>
      <Container>
        <Stack gap={{ xs: 3, md: 4 }}>
          <Typography
            variant="h6"
            sx={{ fontWeight: 900, letterSpacing: 0.5 }}
          >
            {t('footer.brandTitle')}
          </Typography>

          <Grid container spacing={{ xs: 3, md: 4 }}>
            <Grid item xs={12} md={4}>
              <Stack gap={1}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {t('footer.contacts')}
                </Typography>

                <Typography variant="body2">
                  {t('footer.phone')}:{' '}
                  <Link
                    href={`tel:${clientConfig.supportPhoneTel}`}
                    color="inherit"
                    underline="hover"
                  >
                    {clientConfig.supportPhone}
                  </Link>
                </Typography>

                <Typography variant="body2">
                  {t('footer.email')}:{' '}
                  <Link
                    href={`mailto:${clientConfig.supportEmail}`}
                    color="inherit"
                    underline="hover"
                  >
                    {clientConfig.supportEmail}
                  </Link>
                </Typography>

                {showSocials && (
                  <>
                    <Typography variant="body2" sx={{ fontWeight: 700, mt: 2 }}>
                      {t('footer.follow')}
                    </Typography>
                    <Stack direction="row" gap={2} flexWrap="wrap">
                      {socials.map((s) => (
                        <Link
                          key={s.href}
                          href={s.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          color="inherit"
                          underline="hover"
                        >
                          {s.label}
                        </Link>
                      ))}
                    </Stack>
                  </>
                )}
              </Stack>
            </Grid>

            <Grid item xs={12} md={4}>
              <Stack gap={1}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {t('footer.column2Title')}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9, whiteSpace: 'pre-line' }}>
                  {col2}
                </Typography>
              </Stack>
            </Grid>

            <Grid item xs={12} md={4}>
              <Stack gap={1}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {t('footer.column3Title')}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9, whiteSpace: 'pre-line' }}>
                  {col3}
                </Typography>
              </Stack>
            </Grid>
          </Grid>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)' }} />

          <Typography variant="caption" component="div" sx={{ opacity: 0.85 }}>
            <Box component="span" sx={{ opacity: 0.75 }}>
              © {new Date().getFullYear()} {t('footer.copyrightEntity')}
            </Box>
            {' · '}
            <Link
              component={RouterLink}
              to="/caste-dotazy"
              color="inherit"
              sx={{ fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3, opacity: 1 }}
            >
              {t('footer.faq')}
            </Link>
            {' · '}
            {privacyIsExternal ? (
              <Link
                href={clientConfig.legalPrivacyUrl}
                color="inherit"
                target="_blank"
                rel="noopener noreferrer"
                sx={{ fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3, opacity: 1 }}
              >
                {t('footer.privacy')}
              </Link>
            ) : (
              <Link
                component={RouterLink}
                to="/ochrana-osobnich-udaju"
                color="inherit"
                sx={{ fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3, opacity: 1 }}
              >
                {t('footer.privacy')}
              </Link>
            )}
            {impressum && (
              <>
                {' · '}
                <Link
                  href={impressum}
                  color="inherit"
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3, opacity: 1 }}
                >
                  {t('footer.imprint')}
                </Link>
              </>
            )}
          </Typography>
        </Stack>
      </Container>
    </Box>
  )
}
