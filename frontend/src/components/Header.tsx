// frontend/src/components/Header.tsx
import React from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Box, Container, Stack, Button } from '@mui/material'
import { useAuth } from '../context/AuthContext'

type Props = {
  logoSrc?: string
  subtitle?: string
}

export default function Header({
  logoSrc = '/logo1.png',
  subtitle = 'Adopce na dálku',
}: Props) {
  const { token, role, logout } = useAuth()

  const dashboardHref =
    role === 'ADMIN' ? '/admin'
    : role === 'MODERATOR' ? '/moderator'
    : role === 'USER' ? '/user'
    : '/login'

  const accountLabel = !token
    ? 'Přihlášení'
    : role === 'ADMIN' ? 'Admin'
    : role === 'MODERATOR' ? 'Moderátor'
    : 'Můj účet'

  return (
    <Box
      component="header"
      sx={{
        position: 'relative',
        backgroundColor: '#23D3DF',
        color: '#000',
      }}
    >
      <Container maxWidth="lg" sx={{ py: { xs: 1.25, md: 1.75 } }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={2}
        >
          {/* Logo + subtitle (logo ~70% on mobile) */}
          <Button
            component={RouterLink}
            to="/"
            color="inherit"
            sx={{ px: 0, minWidth: 'auto', '&:hover': { bgcolor: 'transparent' } }}
          >
            <Stack direction="column" spacing={0} alignItems="flex-start">
              <img
                src={logoSrc}
                alt="DOGPOINT"
                style={{
                  height: 'auto',
                  display: 'block',
                  objectFit: 'contain',
                  // ~70% size on mobile, grow on larger screens
                  width: '70%',
                  maxWidth: 170,
                }}
              />
              <span
                style={{
                  marginTop: 4,
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#ffffff',
                  lineHeight: 1.1,
                  whiteSpace: 'nowrap',
                }}
              >
                {subtitle}
              </span>
            </Stack>
          </Button>

          {/* Menu trimmed → only account button(s) */}
          {!token ? (
            <Button
              component={RouterLink}
              to="/login"
              variant="outlined"
              sx={pillBtn}
            >
              {accountLabel}
            </Button>
          ) : (
            <Stack direction="row" spacing={1}>
              <Button
                component={RouterLink}
                to={dashboardHref}
                variant="outlined"
                sx={pillBtn}
              >
                {accountLabel}
              </Button>
              <Button onClick={logout} variant="text" sx={textBtn}>
                Odhlásit
              </Button>
            </Stack>
          )}
        </Stack>
      </Container>

      {/* Bigger wave on mobile + 5px white border */}
      <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: -1, lineHeight: 0 }}>
        <svg
          viewBox="0 0 1440 100"
          preserveAspectRatio="none"
          style={{
            width: '100%',
            height: '86px',          // bigger on mobile
          }}
        >
          <path
            // slightly deeper curve so subtitle stays fully visible on small screens
            d="M0,60 C260,110 520,26 780,36 C1040,46 1300,88 1440,76 L1440,100 L0,100 Z"
            fill="#ffffff"
            stroke="#ffffff"
            strokeWidth="5"
          />
        </svg>
      </Box>
    </Box>
  )
}

const textBtn = {
  color: '#000',
  fontWeight: 800,
  letterSpacing: 0.4,
  textTransform: 'uppercase',
  height: 36,
  px: 1,
  '&:hover': { backgroundColor: 'rgba(255,255,255,0.35)' },
} as const

const pillBtn = {
  ...textBtn,
  borderRadius: 18,
  borderColor: 'rgba(0,0,0,0.35)',
} as const