// frontend/src/pages/AdminStats.tsx
import React, { useEffect, useState } from 'react'
import { Container, Typography, Paper, Grid, Alert, Stack } from '@mui/material'
import { getJSON } from '../services/api'

type Stats = {
  users: { total: number; donorsApprox: number }
  content: {
    animalsActive: number
    animalsPending: number
    postsPublished: number
    postsPending: number
  }
  money: {
    expectedMonthlyCZK: number
    paidThisMonthCZK: number
    paidThisMonthCount: number
    paidLastMonthCZK: number
    paidLastMonthCount: number
  }
  flow: {
    pledgesPending: number
    subscriptionsActive: number
    subscriptionsPending: number
  }
}

function czk(n: number) {
  return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK' }).format(n || 0)
}

function Card({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, height: '100%' }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
        {title}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 900, mt: 0.5 }}>
        {value}
      </Typography>
      {sub && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {sub}
        </Typography>
      )}
    </Paper>
  )
}

export default function AdminStats() {
  const [data, setData] = useState<Stats | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        setErr(null)
        const res = await getJSON<Stats>('/api/admin/stats')
        if (alive) setData(res)
      } catch (e: any) {
        if (alive) setErr(e?.message || 'Nepodařilo se načíst statistiky.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Stack spacing={1} sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 900 }}>
          Statistiky
        </Typography>
        <Typography color="text.secondary">
          Admin přehled: platby, dárci, schvalování obsahu.
        </Typography>
      </Stack>

      {err && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {err}
        </Alert>
      )}

      {loading && <Typography color="text.secondary">Načítám…</Typography>}

      {data && (
        <Grid container spacing={2}>
          {/* Peníze */}
          <Grid item xs={12} md={4}>
            <Card
              title="Očekávaný měsíční příjem (aktivní předplatné)"
              value={czk(data.money.expectedMonthlyCZK)}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <Card
              title="Přijato tento měsíc"
              value={czk(data.money.paidThisMonthCZK)}
              sub={`${data.money.paidThisMonthCount} plateb`}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <Card
              title="Přijato minulý měsíc"
              value={czk(data.money.paidLastMonthCZK)}
              sub={`${data.money.paidLastMonthCount} plateb`}
            />
          </Grid>

          {/* Uživatelé / adopce */}
          <Grid item xs={12} sm={6} md={3}>
            <Card title="Uživatelé celkem" value={String(data.users.total)} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card
              title="Dárci (odhad)"
              value={String(data.users.donorsApprox)}
              sub="uživatelé s předplatným"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card title="Aktivní předplatné" value={String(data.flow.subscriptionsActive)} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card title="Čekající předplatné" value={String(data.flow.subscriptionsPending)} />
          </Grid>

          {/* Obsah */}
          <Grid item xs={12} sm={6} md={3}>
            <Card title="Zvířata aktivní" value={String(data.content.animalsActive)} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card title="Zvířata ke schválení" value={String(data.content.animalsPending)} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card title="Příspěvky publikované" value={String(data.content.postsPublished)} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card title="Příspěvky ke schválení" value={String(data.content.postsPending)} />
          </Grid>

          {/* Flow */}
          <Grid item xs={12} md={4}>
            <Card title="Přísliby (čekající)" value={String(data.flow.pledgesPending)} />
          </Grid>
        </Grid>
      )}
    </Container>
  )
}