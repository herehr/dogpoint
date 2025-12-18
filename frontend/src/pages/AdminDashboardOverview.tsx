// frontend/src/pages/AdminDashboardOverview.tsx
import React, { useEffect, useState } from 'react'
import { Container, Typography, Grid, Paper, Alert } from '@mui/material'
import { getJSON } from '../services/api'

type Props = { embedded?: boolean }

function Card({ title, value, sub }: { title: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: 3, borderRadius: 4, height: '100%' }}>
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 900, mt: 0.5 }}>
        {value}
      </Typography>
      {sub ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {sub}
        </Typography>
      ) : null}
    </Paper>
  )
}

export default function AdminDashboardOverview({ embedded = false }: Props) {
  const [data, setData] = useState<any>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setErr(null)
        const r = await getJSON('/api/admin/dashboard/overview')
        if (alive) setData(r)
      } catch (e: any) {
        if (alive) setErr(e?.message || 'Chyba načítání dashboardu')
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const content = (
    <>
      {!embedded && (
        <>
          <Typography variant="h4" sx={{ fontWeight: 900, mb: 2 }}>
            Statistiky
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Admin přehled: platby, dárci, schvalování obsahu.
          </Typography>
        </>
      )}

      {err && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {err}
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Card title="Očekávaný měsíční příjem (aktivní předplatné)" value={`${data?.expectedMonthlyCzk ?? '—'} Kč`} />
        </Grid>

        <Grid item xs={12} md={4}>
          <Card
            title="Přijato tento měsíc"
            value={`${data?.receivedThisMonthCzk ?? '—'} Kč`}
            sub={data ? `${data.receivedThisMonthCount} plateb` : '—'}
          />
        </Grid>

        <Grid item xs={12} md={4}>
          <Card
            title="Přijato minulý měsíc"
            value={`${data?.receivedPrevMonthCzk ?? '—'} Kč`}
            sub={data ? `${data.receivedPrevMonthCount} plateb` : '—'}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card title="Uživatelé celkem" value={data?.usersTotal ?? '—'} />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card title="Dárci (odhad)" value={data?.donorsEstimate ?? '—'} sub="uživatelé s předplatným" />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card title="Aktivní předplatné" value={data?.subsActiveCount ?? '—'} />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card title="Čekající předplatné" value={data?.subsPendingCount ?? '—'} />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card title="Zvířata aktivní" value={data?.animalsActive ?? '—'} />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card title="Zvířata ke schválení" value={data?.animalsPending ?? '—'} />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card title="Příspěvky publikované" value={data?.postsPublished ?? '—'} />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card title="Příspěvky ke schválení" value={data?.postsPending ?? '—'} />
        </Grid>
      </Grid>
    </>
  )

  if (embedded) return content

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {content}
    </Container>
  )
}