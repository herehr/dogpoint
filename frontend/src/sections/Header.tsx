// frontend/src/components/Header.tsx
import React from 'react'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import { Box, Container, Stack, Button } from '@mui/material'
import { useAuth } from '../context/AuthContext'

type Props = { logoSrc?: string; subtitle?: string }
export default function Header({ logoSrc = '/logo1.png', subtitle = 'Adopce na dálku' }: Props) {
  const { token, role, logout } = useAuth()
  const location = useLocation()
  const dashboardHref =
    role === 'ADMIN' ? '/admin' : role === 'MODERATOR' ? '/moderator' : role === 'USER' ? '/user' : '/login'

  const onLoginLabel = !token ? 'PŘIHLÁŠENÍ' : role === 'ADMIN' ? 'ADMIN' : role === 'MODERATOR' ? 'MODERÁTOR' : 'MŮJ ÚČET'

  return (
    <Box component="header" sx={{ position: 'relative', backgroundColor: '#23D3DF', color: '#000' }}>
      <Container maxWidth="lg" sx={{ py: { xs: 1.5, md: 2 } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
          {/* Logo + subtitle */}
          <Button component={RouterLink} to="/" color="inherit" sx={{ px: 0, minWidth: 'auto', '&:hover': { bgcolor: 'transparent' } }}>
            <Stack direction="column" spacing={0} alignItems="flex-start">
              <img src={logoSrc} alt="DOGPOINT" style={{ height: 40, display: 'block', objectFit: 'contain' }} />
              <span style={{ marginTop: 2, fontSize: 14, fontWeight: 700, color: '#ffffff' }}>{subtitle}</span>
            </Stack>
          </Button>

          {/* Menu */}
          <Stack direction="row" spacing={{ xs: 1, sm: 2.5, md: 4 }} alignItems="center">
            <NavLink to={location.pathname === '/' ? '#jak-to-funguje' : '/#jak-to-funguje'}>JAK TO FUNGUJE</NavLink>
            <NavLink to="/zvirata">ADOPCE</NavLink>
            <NavLink to={location.pathname === '/' ? '#o-nas' : '/#o-nas'}>O NÁS</NavLink>

            {!token ? (
              <Button component={RouterLink} to="/login" variant="outlined" sx={pillBtn}>
                {onLoginLabel}
              </Button>
            ) : (
              <Stack direction="row" spacing={1}>
                <Button component={RouterLink} to={dashboardHref} variant="outlined" sx={pillBtn}>
                  {onLoginLabel}
                </Button>
                <Button onClick={logout} variant="text" sx={textBtn}>
                  ODHlÁSIT
                </Button>
              </Stack>
            )}
          </Stack>
        </Stack>
      </Container>

      {/* Wave with 5px white border */}
      <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: -1, lineHeight: 0 }}>
        <svg viewBox="0 0 1440 90" preserveAspectRatio="none" style={{ width: '100%', height: 64, display: 'block' }}>
          {/* white border (stroke) */}
          <path
            d="M0,50 C260,100 520,18 780,28 C1040,38 1300,80 1440,68 L1440,90 L0,90 Z"
            fill="#ffffff"
            stroke="#ffffff"
            strokeWidth="5"
          />
        </svg>
      </Box>
    </Box>
  )
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const isHash = to.startsWith('#') || to.startsWith('/#')
  const Comp: any = isHash ? 'a' : RouterLink
  const props = isHash ? { href: to } : { to }
  return (
    <Button component={Comp} {...props} variant="text" sx={textBtn}>
      {children}
    </Button>
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