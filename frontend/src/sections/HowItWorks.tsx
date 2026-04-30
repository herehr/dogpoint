// frontend/src/sections/HowItWorks.tsx
import React from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Box, Container, Grid, Link, Paper, Stack, Typography } from '@mui/material'
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism'
import DevicesIcon from '@mui/icons-material/Devices'
import PaymentsIcon from '@mui/icons-material/Payments'

const items = [
  {
    icon: <VolunteerActivismIcon fontSize="large" />,
    title: 'Podpořte svého oblíbence',
    text:
      'Vyberte si pejska, kterého si chcete virtuálně adoptovat. Poté zvolte výši pravidelné měsíční podpory. Minimální částka je 50 Kč, ale rozhodně to může být víc. Patroni si nejčastěji volí výši daru kolem 200 Kč.',
  },
  {
    icon: <PaymentsIcon fontSize="large" />,
    title: 'Vytvořte si účet patrona',
    text:
      'Během zadávání údajů k platbě si vytvoříte účet patrona. Po zaplacení prvního příspěvku se vám odemkne prémiový obsah u vybraného pejska. Dozvíte se, jak se má a co v útulku dělá. Zároveň vám na uvedený e-mail přijde certifikát patrona.',
  },
  {
    icon: <DevicesIcon fontSize="large" />,
    title: 'Sledujte, jak se váš pejsek má',
    text:
      'U pejsků pravidelně přidáváme nové fotky, videa a příběhy, které si jako patron můžete zobrazit. Nebojte, o nic nepřijdete. Na každou novinku vás upozorníme e-mailem.',
  },
]

export default function HowItWorks() {
  return (
    <Box id="jak" sx={{ py: { xs: 6, md: 8 } }}>
      <Container>
        <Typography variant="h4" sx={{ fontWeight: 900, mb: 3 }}>
          Adopce na dálku ve 3 krocích
        </Typography>

        <Grid container spacing={2}>
          {items.map((card, i) => (
            <Grid item xs={12} md={4} key={i}>
              <Paper variant="outlined" sx={{ p: 3, height: '100%' }}>
                <Stack gap={1.5}>
                  <Box sx={{ '& svg': { color: 'secondary.main' } }}>{card.icon}</Box>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    {card.title}
                  </Typography>
                  <Typography color="text.secondary">{card.text}</Typography>
                </Stack>
              </Paper>
            </Grid>
          ))}
        </Grid>

        <Typography color="text.secondary" sx={{ mt: 4, maxWidth: 720 }}>
          Chcete vědět víc? Potřebujete s něčím pomoct? Podívejte se na{' '}
          <Link
            component={RouterLink}
            to="/caste-dotazy"
            color="secondary"
            sx={{ fontWeight: 700, textUnderlineOffset: 3 }}
          >
            nejčastější otázky
          </Link>
          , které jsme pro vás sepsali.
        </Typography>
      </Container>
    </Box>
  )
}