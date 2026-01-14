// frontend/src/components/Header.tsx
import React, { useEffect, useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import {
  Box,
  Container,
  Stack,
  Button,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Divider,
} from '@mui/material'
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone'
import NotificationsIcon from '@mui/icons-material/Notifications'
import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import { useAuth } from '../context/AuthContext'
import { fetchMyNotifications } from '../services/api'

type Props = {
  logoSrc?: string
  subtitle?: string
}

const LAST_SEEN_KEY = 'dp:lastSeenNotificationTs'

export default function Header({
  logoSrc = '/logo1.png',
  subtitle = 'Adopce na dálku',
}: Props) {
  const navigate = useNavigate()
  const { token, role, user, logout } = useAuth()

  const isAdmin = role === 'ADMIN'
  const isMod = role === 'MODERATOR'
  const isUser = role === 'USER'

  const [hasNewNotifications, setHasNewNotifications] = useState(false)

  // ✅ Mobile account menu
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const menuOpen = Boolean(anchorEl)
  const openMenu = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget)
  const closeMenu = () => setAnchorEl(null)

  // Destination for account button (admin/mod only)
  const dashboardHref = isAdmin ? '/admin' : isMod ? '/moderator' : '/login'

  const accountLabel = !token ? 'Přihlášení' : isAdmin ? 'Admin' : isMod ? 'Moderátor' : ''

  const handleLogout = () => {
    closeMenu()
    logout()
    navigate('/') // return to homepage after logout
  }

  // Check if there are new notifications for USER
  useEffect(() => {
    if (!token || role !== 'USER') {
      setHasNewNotifications(false)
      return
    }

    let alive = true

    ;(async () => {
      try {
        const items = await fetchMyNotifications()
        if (!alive || items.length === 0) return

        const lastSeenRaw = localStorage.getItem(LAST_SEEN_KEY)
        const lastSeen = lastSeenRaw ? new Date(lastSeenRaw) : null
        const newestTs = items[0]?.publishedAt ? new Date(items[0].publishedAt) : null

        if (newestTs && (!lastSeen || newestTs > lastSeen)) {
          setHasNewNotifications(true)
        } else {
          setHasNewNotifications(false)
        }
      } catch (e) {
        console.warn('[Header] notifications check failed', e)
      }
    })()

    return () => {
      alive = false
    }
  }, [token, role])

  return (
    <Box
      component="header"
      sx={{
        position: 'relative',
        backgroundColor: '#26E6EA',
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
            sx={{
              px: 0,
              minWidth: 'auto',
              '&:hover': { bgcolor: 'transparent' },
            }}
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
            <>
              {/* ✅ Mobile actions: account menu + bell */}
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ display: { xs: 'flex', md: 'none' } }}
              >
                {/* Notifications bell (mobile) */}
                <IconButton
                  component={RouterLink}
                  to="/notifikace"
                  sx={{
                    position: 'relative',
                    borderRadius: '50%',
                    border: '1px solid rgba(0,0,0,0.35)',
                    width: 36,
                    height: 36,
                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.35)' },
                  }}
                  aria-label="Notifikace"
                  onClick={() => setHasNewNotifications(false)}
                >
                  {hasNewNotifications ? <NotificationsIcon className="notification-icon blink" /> : <NotificationsNoneIcon />}
                  {hasNewNotifications && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 5,
                        right: 5,
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: '#ff1744',
                        animation: 'notifPulse 1.2s ease-in-out infinite',
                      }}
                    />
                  )}
                </IconButton>

                {/* Account menu (mobile) */}
                <IconButton
                  onClick={openMenu}
                  sx={{
                    borderRadius: '50%',
                    border: '1px solid rgba(0,0,0,0.35)',
                    width: 36,
                    height: 36,
                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.35)' },
                  }}
                  aria-label="Účet"
                >
                  <AccountCircleIcon />
                </IconButton>

                <Menu
                  anchorEl={anchorEl}
                  open={menuOpen}
                  onClose={closeMenu}
                  keepMounted
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                  {user?.email && <MenuItem disabled>{user.email}</MenuItem>}
                  {user?.email && <Divider />}

                  {isUser && (
                    <MenuItem
                      onClick={() => {
                        closeMenu()
                        navigate('/user')
                      }}
                    >
                      Moje adopce
                    </MenuItem>
                  )}

                  {(isAdmin || isMod) && (
                    <MenuItem
                      onClick={() => {
                        closeMenu()
                        navigate(dashboardHref)
                      }}
                    >
                      {accountLabel || 'Dashboard'}
                    </MenuItem>
                  )}

                  <Divider />
                  <MenuItem onClick={handleLogout}>Odhlásit</MenuItem>
                </Menu>
              </Stack>

              {/* ✅ Desktop actions (unchanged) */}
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ display: { xs: 'none', md: 'flex' } }}
              >
                {/* user email */}
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

                {/* USER: Moje adopce button */}
                {isUser && (
                  <Button component={RouterLink} to="/user" variant="outlined" sx={pillBtn}>
                    Moje&nbsp;adopce
                  </Button>
                )}

                {/* ADMIN / MOD: dashboard button */}
                {(isAdmin || isMod) && (
                  <Button component={RouterLink} to={dashboardHref} variant="outlined" sx={pillBtn}>
                    {accountLabel}
                  </Button>
                )}

                {/* Notifications bell (desktop) */}
                <IconButton
                  component={RouterLink}
                  to="/notifikace"
                  sx={{
                    position: 'relative',
                    borderRadius: '50%',
                    border: '1px solid rgba(0,0,0,0.35)',
                    width: 36,
                    height: 36,
                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.35)' },
                  }}
                  aria-label="Notifikace"
                  onClick={() => setHasNewNotifications(false)}
                >
                  {hasNewNotifications ? <NotificationsIcon className="notification-icon blink" /> : <NotificationsNoneIcon />}
                  {hasNewNotifications && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 5,
                        right: 5,
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: '#ff1744',
                        animation: 'notifPulse 1.2s ease-in-out infinite',
                      }}
                    />
                  )}
                </IconButton>

                {/* Logout (desktop) */}
                <Button onClick={handleLogout} variant="text" sx={textBtn}>
                  Odhlásit
                </Button>
              </Stack>
            </>
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