// frontend/src/pages/AdminStatistics.tsx
import React, { useState } from 'react'
import { Container, Typography, Paper, Stack, ToggleButtonGroup, ToggleButton, Box } from '@mui/material'
import AdminDashboardOverview from './AdminDashboardOverview'
import AdminStats from './AdminStats'

export default function AdminStatistics() {
  const [mode, setMode] = useState<'kpi' | 'details'>('kpi')

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900 }}>
            Statistiky
          </Typography>
          <Typography color="text.secondary">
            Přehled (KPI) a detailní statistiky adopcí.
          </Typography>
        </Box>

        <Paper sx={{ p: 1.5, borderRadius: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
            <ToggleButtonGroup
              exclusive
              value={mode}
              onChange={(_, v) => v && setMode(v)}
              size="small"
            >
              <ToggleButton value="kpi">Přehled</ToggleButton>
              <ToggleButton value="details">Detaily</ToggleButton>
            </ToggleButtonGroup>

            <Box sx={{ flex: 1 }} />
          </Stack>
        </Paper>

        {mode === 'kpi' ? <AdminDashboardOverview embedded /> : <AdminStats embedded />}
      </Stack>
    </Container>
  )
}