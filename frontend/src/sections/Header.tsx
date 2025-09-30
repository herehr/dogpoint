// frontend/src/components/Header.tsx
import React from 'react'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import { Box, Container, Stack, Button } from '@mui/material'
import { useAuth } from '../context/AuthContext'

type Props = {
  /** Path to logo image (PNG/SVG). Default: /logo1.png */
  logoSrc?: string
}

/**
 * Branded top bar with a curved (wave) bottom edge.
 * Mobile-first, responsive, and uses an inline SVG for the wave.
 */
export default function Header({ logoSrc = '/logo1.png' }: Props) {
  const { token, role, logout } = useAuth()
  const location = useLocation()

  const dashboardHref =
    role === 'ADMIN'
      ? '/admin'
      : role === 'MODERATOR'
      ? '/moderator'
      : role === 'USER'
      ? '/user'
      : '/login'

  const isHome = location.pathname === '/'

  return (
    <Box
      component="header"
      sx={{
        position: 'relative',
        backgroundColor: '#24D1E7', // turquoise
        color: '#000',
        // give some elevation feel
        boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
      }}
    >
      {/* Top bar */}
      <Container maxWidth="lg" sx={{ py: { xs: 1.25, md: 1.5 } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
          {/* Logo → Home */}
          <Button
            component={RouterLink}
            to="/"
            color="inherit"
            sx={{
              px: 0,
              minWidth: 'auto',
              '&:hover': { backgroundColor: 'transparent', opacity: 0.9 },
            }}
          >
            <img
              src={logoSrc}
              alt="DOGPOINT"
              style={{ height: 34, display: 'block', objectFit: 'contain' }}
            />
          </Button>

          {/* Menu */}
          <Stack direction="row" spacing={{ xs: 1, sm: 2, md: 3 }} alignItems="center">
            <NavLink to={isHome ? '#jak-to-funguje' : '/#jak-to-funguje'} label="JAK TO FUNGUJE" />
            <NavLink to="/zvirata" label="ADOPCE" />
            <NavLink to={isHome ? '#o-nas' : '/#o-nas'} label="O NÁS" />

            {!token ? (
              <Button
                component={RouterLink}
                to="/login"
                variant="text"
                sx={menuBtnSx(true)}
              >
                PŘIHLÁŠENÍ
              </Button>
            ) : (
              <Stack direction="row" spacing={1}>
                <Button
                  component={RouterLink}
                  to={dashboardHref}
                  variant="outlined"
                  sx={{
                    borderColor: 'rgba(0,0,0,0.3)',
                    color: '#000',
                    fontWeight: 700,
                    letterSpacing: 0.3,
                    height: 36,
                    px: 1.5,
                    '&:hover': { borderColor: 'rgba(0,0,0,0.5)', backgroundColor: 'rgba(255,255,255,0.3)' },
                  }}
                >
                  {role === 'ADMIN' ? 'ADMIN' : role === 'MODERATOR' ? 'MODERÁTOR' : 'MŮJ ÚČET'}
                </Button>
                <Button
                  onClick={logout}
                  variant="text"
                  sx={menuBtnSx()}
                >
                  ODHlÁSIT
                </Button>
              </Stack>
            )}
          </Stack>
        </Stack>
      </Container>

      {/* Curved white “wave” at the bottom */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: -1, // tiny overlap for no seam
          lineHeight: 0,
        }}
      >
        <svg
          viewBox="0 0 1440 110"
          preserveAspectRatio="none"
          style={{ display: 'block', width: '100%', height: '60px' }}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* white wave that cuts the turquoise bar */}
          <path
            fill="#ffffff"
            d="M0,64 C180,110 360,110 540,86 C720,62 900,4 1080,8 C1200,11 1320,45 1440,70 L1440,110 L0,110 Z"
          />
        </svg>
      </Box>
    </Box>
  )
}

function NavLink({ to, label }: { to: string; label: string }) {
  const isHash = to.startsWith('#') || to.startsWith('/#')
  const Comp: any = isHash ? 'a' : RouterLink
  const hrefProps = isHash ? { href: to } : { to }

  return (
    <Button
      component={Comp}
      {...hrefProps}
      variant="text"
      sx={menuBtnSx(true)}
    >
      {label}
    </Button>
  )
}

function menuBtnSx(uppercase = false) {
  return {
    color: '#000',
    fontWeight: 700,
    letterSpacing: 0.3,
    height: 36,
    px: { xs: 0.5, sm: 1 },
    ...(uppercase ? { textTransform: 'uppercase' } : {}),
    '&:hover': {
      backgroundColor: 'rgba(255,255,255,0.35)',
    },
  } as const
}