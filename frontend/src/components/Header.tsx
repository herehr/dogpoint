// frontend/src/components/Header.tsx
import React from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { Box, Container, Stack, Button, Typography } from '@mui/material'
import { useAuth } from '../context/AuthContext'

type Props = {
  logoSrc?: string
  subtitle?: string
}

export default function Header({
  logoSrc = '/logo1.png',
  subtitle = 'Adopce na dálku',
}: Props) {
  const navigate = useNavigate()
  const { token, role, user, logout } = useAuth()

  const isAdmin = role === 'ADMIN'
  const isMod   = role === 'MODERATOR'
  const isUser  = role === 'USER'

  // Destination for the primary account button
  const dashboardHref =
  !token ? '/login'
  : isAdmin ? '/admin'
  : isMod   ? '/moderator'
  : null;   // ❗ no dashboard for regular users

const accountLabel =
  !token ? 'Přihlášení'
  : isAdmin ? 'Admin'
  : isMod   ? 'Moderátor'
  : null;   // ❗ no label for regular users

  const handleLogout = () => {
    logout()
    navigate('/') // return to homepage after logout
  }

  return (
    <Box
      component="header"
      sx={{
        position: 'relative',
        backgroundColor: '#23D3DF',
        color: '#000',
        overflow: 'hidden',
      }}
    >
      <Container
        maxWidth="lg"
        sx={{
          pt: { xs: 1, md: 1.5 },
          pb: { xs: 6, md: 8 },
          position: 'relative',
          zIndex: 2,
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
          {/* Logo + subtitle */}
          <Button
            component={RouterLink}
            to="/"
            color="inherit"
            sx={{ px: 0, minWidth: 'auto', '&:hover': { bgcolor: 'transparent' } }}
            aria-label="Domů"
          >
            <Stack direction="column" spacing={0} alignItems="flex-start">
              <Box
                component="img"
                src={logoSrc}
                alt="DOGPOINT"
                sx={{
                  height: { xs: 24, sm: 32, md: 40 },
                  display: 'block',
                  objectFit: 'contain',
                }}
              />
              <Box
                component="span"
                sx={{
                  mt: 0.5,
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#fff',
                  lineHeight: 1.1,
                  whiteSpace: 'nowrap',
                }}
              >
                {subtitle}
              </Box>
            </Stack>
          </Button>

          {/* Account area */}
          {!token ? (
            <Button component={RouterLink} to="/login" variant="outlined" sx={pillBtn}>
              PŘIHLÁŠENÍ
            </Button>
          ) : (
            <Stack direction="row" spacing={1} alignItems="center">
              {/* Show user email (trimmed) when logged in */}
              {user?.email && (
                <Typography
                  variant="body2"
                  sx={{
                    maxWidth: { xs: 120, sm: 200 },
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: 700,
                  }}
                  title={user.email}
                >
                  {user.email}
                </Typography>
              )}

              {/* For USER role, offer direct “Moje adopce” */}
              {isUser && (
                <Button component={RouterLink} to="/user" variant="outlined" sx={pillBtn}>
                  Moje&nbsp;adopce
                </Button>
              )}

              {/* Primary account/dashboard button (roles keep their targets) */}
              <Button component={RouterLink} to={dashboardHref} variant="outlined" sx={pillBtn}>
                {accountLabel}
              </Button>

              {/* Logout */}
              <Button onClick={handleLogout} variant="text" sx={textBtn}>
                Odhlásit
              </Button>
            </Stack>
          )}
        </Stack>
      </Container>

      {/* Decorative wave */}
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: -1,
          lineHeight: 0,
          zIndex: 1,
          pointerEvents: 'none',
        }}
      >
        <svg
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
          style={{ width: '100%', height: '110px', display: 'block' }}
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M0,66 C260,116 520,30 780,40 C1040,50 1300,94 1440,82 L1440,120 L0,120 Z"
            fill="#ECFBFB"
          />
          <path
            d="M0,66 C260,116 520,30 780,40 C1040,50 1300,94 1440,82"
            fill="none"
            stroke="#ffffff"
            strokeWidth="10"
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