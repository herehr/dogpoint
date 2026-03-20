// frontend/src/pages/UserDashboard.tsx
import React from 'react'
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  CardMedia,
  Stack,
  Chip,
  Alert,
  Skeleton,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material'
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import PersonAddAlt1OutlinedIcon from '@mui/icons-material/PersonAddAlt1Outlined'
import ShareInviteDialog from '../components/ShareInviteDialog'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import {
  myAdoptedAnimals,
  markAnimalSeen,
  listGiftRecipients,
  addGiftRecipient,
  removeGiftRecipient,
  type MyAdoptedItem,
  type GiftRecipient,
  setAuthToken,
  apiUrl,
} from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function UserDashboard() {
  const { user, refreshMe } = useAuth()
  const location = useLocation()

  const [items, setItems] = React.useState<MyAdoptedItem[] | null>(null)
  const [err, setErr] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  const loadAdoptions = React.useCallback(async () => {
    setLoading(true)
    setErr(null)

    try {
      const list = await myAdoptedAnimals()
      setItems(list || [])
    } catch (e: any) {
      const msg = (e?.message || '').toString()

      // 👉 If backend returns 404 / "Not Found", treat it as "no adoptions yet"
      if (msg.toLowerCase().includes('not found') || msg.includes('404')) {
        setItems([])
        setErr(null)
      } else {
        setErr(msg || 'Nepodařilo se načíst adopce')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  /* ------------------------------------------------------------------
   * 1) Handle Stripe return: ?paid=1&sid=cs_...
   * ------------------------------------------------------------------ */
  React.useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        const params = new URLSearchParams(location.search)
        const sid = params.get('sid')
        const paid = params.get('paid')

        if (!sid || paid !== '1') return

        // ✅ Call backend confirm endpoint (use apiUrl to avoid wrong base)
        const resp = await fetch(`${apiUrl('/api/stripe/confirm')}?sid=${encodeURIComponent(sid)}`, {
          method: 'GET',
          credentials: 'include',
        })

        if (!resp.ok) {
          console.warn('[UserDashboard] stripe/confirm failed', resp.status)
          return
        }

        const data = await resp.json()
        if (cancelled) return

        const token = data?.token as string | undefined
        if (data?.ok && token) {
          // ✅ Save token and refresh user info via AuthContext
          setAuthToken(token)
          await refreshMe()

          // ✅ IMPORTANT: immediately refresh the adoption list
          await loadAdoptions()
        }
      } catch (e) {
        console.warn('[UserDashboard] Stripe confirm handler error', e)
      } finally {
        // Clean URL params (?paid=1&sid=...) to avoid re-trigger
        try {
          const p = new URLSearchParams(location.search)
          p.delete('paid')
          p.delete('sid')
          const clean = `${window.location.pathname}${p.toString() ? `?${p}` : ''}`
          window.history.replaceState({}, '', clean)
        } catch {
          // ignore
        }
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [location.search, refreshMe, loadAdoptions])

  /* ------------------------------------------------------------------
   * 2) Load "Moje adopce" whenever we have/refresh a user
   * ------------------------------------------------------------------ */
  React.useEffect(() => {
    // When user changes (login/logout), reload list
    void loadAdoptions()
  }, [user, loadAdoptions])

  const onSeen = async (animalId: string) => {
    try {
      await markAnimalSeen(animalId)
    } catch {
      // silent fail is OK here – UX detail only
    }
  }

  const [giftDialog, setGiftDialog] = React.useState<{
    open: boolean
    subscriptionId: string
    animalName: string
  } | null>(null)
  const [giftRecipients, setGiftRecipients] = React.useState<GiftRecipient[]>([])
  const [giftLoading, setGiftLoading] = React.useState(false)
  const [giftErr, setGiftErr] = React.useState<string | null>(null)
  const [newEmail, setNewEmail] = React.useState('')
  const [newDisplayName, setNewDisplayName] = React.useState('')
  const [adding, setAdding] = React.useState(false)

  const [shareDialog, setShareDialog] = React.useState<{
    subscriptionId: string
    animalName: string
  } | null>(null)

  const openGiftDialog = async (subscriptionId: string, animalName: string) => {
    setGiftDialog({ open: true, subscriptionId, animalName })
    setGiftRecipients([])
    setGiftErr(null)
    setNewEmail('')
    setNewDisplayName('')
    setGiftLoading(true)
    try {
      const list = await listGiftRecipients(subscriptionId)
      setGiftRecipients(list || [])
    } catch (e: any) {
      setGiftErr(e?.message || 'Nepodařilo se načíst obdarované')
    } finally {
      setGiftLoading(false)
    }
  }

  const closeGiftDialog = () => setGiftDialog(null)

  const handleAddGiftRecipient = async () => {
    if (!giftDialog || !newEmail.trim()) return
    setAdding(true)
    setGiftErr(null)
    try {
      const added = await addGiftRecipient(giftDialog.subscriptionId, {
        email: newEmail.trim(),
        displayName: newDisplayName.trim() || undefined,
      })
      setGiftRecipients((prev) => [...prev, added])
      setNewEmail('')
      setNewDisplayName('')
    } catch (e: any) {
      setGiftErr(e?.message || 'Nepodařilo se přidat obdarovaného')
    } finally {
      setAdding(false)
    }
  }

  const handleRemoveGiftRecipient = async (recipientId: string) => {
    if (!giftDialog) return
    try {
      await removeGiftRecipient(giftDialog.subscriptionId, recipientId)
      setGiftRecipients((prev) => prev.filter((r) => r.id !== recipientId))
    } catch (e: any) {
      setGiftErr(e?.message || 'Nepodařilo se odebrat obdarovaného')
    }
  }

  return (
    <Container sx={{ py: 4 }}>
      <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 900 }}>
          Moje adopce
        </Typography>
        {user?.email && <Chip label={user.email} variant="outlined" />}
      </Stack>

      {loading && (
        <Grid container spacing={2}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Skeleton variant="rectangular" height={180} />
              <Skeleton variant="text" />
            </Grid>
          ))}
        </Grid>
      )}

      {!!err && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {err}
        </Alert>
      )}

      {!loading && items && items.length === 0 && !err && (
        <Alert severity="info">Zatím tu nic není. Po úspěšné platbě se vaše adopce objeví zde.</Alert>
      )}

      {!loading && items && items.length > 0 && (
        <Grid container spacing={2}>
          {items.map((it) => {
            const title = (it as any).title || (it as any).jmeno || (it as any).name || 'Zvíře'
            const main = (it as any).main
            const since = (it as any).since
            const status = (it as any).status
            const animalId = (it as any).animalId
            const subscriptionId = (it as any).subscriptionId
            const isGiftRecipient = (it as any).isGiftRecipient === true

            return (
              <Grid item xs={12} sm={6} md={4} key={animalId}>
                <Card>
                  <CardActionArea component={RouterLink} to={`/zvire/${animalId}`} onClick={() => onSeen(animalId)}>
                    {main && <CardMedia component="img" height="160" image={main} alt={title} />}
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>
                          {title}
                        </Typography>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          {!isGiftRecipient && subscriptionId && (
                            <>
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  setShareDialog({ subscriptionId, animalName: title })
                                }}
                                title="Sdílet se známým (pozvánka e-mailem)"
                                sx={{ color: 'text.secondary' }}
                              >
                                <PersonAddAlt1OutlinedIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  openGiftDialog(subscriptionId, title)
                                }}
                                title="Darovat adopci – přidat obdarované"
                                sx={{ color: 'primary.main' }}
                              >
                                <CardGiftcardIcon fontSize="small" />
                              </IconButton>
                            </>
                          )}
                          {status && <Chip size="small" label={status} />}
                        </Stack>
                      </Stack>

                      {since && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          od{' '}
                          {new Date(since).toLocaleDateString('cs-CZ', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </Typography>
                      )}

                      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                        <Button size="small" component={RouterLink} to={`/zvire/${animalId}`}>
                          Zobrazit detail
                        </Button>
                      </Stack>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            )
          })}
        </Grid>
      )}

      <Dialog open={!!giftDialog} onClose={closeGiftDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          Darovat adopci – {giftDialog?.animalName || 'Zvíře'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Přidejte e-mail obdarovaného. Ten pak uvidí všechny příspěvky adoptovaného zvířete. Maximálně 5 obdarovaných.
          </Typography>
          {giftErr && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setGiftErr(null)}>
              {giftErr}
            </Alert>
          )}
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <TextField
              size="small"
              label="E-mail obdarovaného"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              fullWidth
              placeholder="napr. kamarad@email.cz"
            />
            <TextField
              size="small"
              label="Jméno (volitelné)"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              sx={{ minWidth: 140 }}
            />
            <Button
              variant="contained"
              onClick={handleAddGiftRecipient}
              disabled={!newEmail.trim() || adding}
            >
              Přidat
            </Button>
          </Stack>
          {giftLoading ? (
            <Typography color="text.secondary">Načítám…</Typography>
          ) : giftRecipients.length === 0 ? (
            <Typography color="text.secondary">Zatím žádní obdarovaní.</Typography>
          ) : (
            <List dense>
              {giftRecipients.map((r) => (
                <ListItem key={r.id}>
                  <ListItemText
                    primary={r.email}
                    secondary={r.displayName || null}
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      size="small"
                      onClick={() => handleRemoveGiftRecipient(r.id)}
                      title="Odebrat"
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeGiftDialog}>Zavřít</Button>
        </DialogActions>
      </Dialog>

      <ShareInviteDialog
        open={!!shareDialog}
        onClose={() => setShareDialog(null)}
        subscriptionId={shareDialog?.subscriptionId || ''}
        animalName={shareDialog?.animalName || ''}
      />
    </Container>
  )
}