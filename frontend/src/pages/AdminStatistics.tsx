// frontend/src/pages/AdminStatistics.tsx
import React, { useMemo, useState } from 'react'
import { Container, Typography, Paper, Stack, ToggleButtonGroup, ToggleButton, Box } from '@mui/material'
import AdminDashboardOverview from './AdminDashboardOverview'
import AdminStats from './AdminStats'

export default function AdminStatistics() {
  const [mode, setMode] = useState<'kpi' | 'details'>('kpi')

  const title = useMemo(() => (mode === 'kpi' ? 'Statistiky' : 'Statistiky'), [mode])

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900 }}>
            {title}
          </Typography>
          <Typography color="text.secondary">
            Admin přehled: platby, dárci, schvalování obsahu.
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

            <Typography variant="body2" color="text.secondary">
              {mode === 'kpi'
                ? 'KPI karty a rychlý přehled.'
                : 'Platby / přísliby / očekávané (tabulky).'}
            </Typography>
          </Stack>
        </Paper>

        {/* Render the chosen view */}
        <Box>
          {mode === 'kpi' ? (
            // IMPORTANT: these pages already render their own Container.
            // We keep it simple: render them "as-is".
            <AdminDashboardOverview />
          ) : (
            <AdminStats />
          )}
        </Box>
      </Stack>
    </Container>
  )
}