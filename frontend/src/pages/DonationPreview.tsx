import React, { useState } from 'react'
import { Container, Typography, Button } from '@mui/material'
import DonationModal from '../components/DonationModal'

const DonationPreview: React.FC = () => {
  const [open, setOpen] = useState(false)
  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>Podpořte nás</Typography>
      <Typography>Vyberte částku a přispějte jednorázově nebo pravidelně.</Typography>
      <Button variant="contained" sx={{ mt: 3 }} onClick={() => setOpen(true)}>
        Darovat
      </Button>
      <DonationModal open={open} onClose={() => setOpen(false)} />
    </Container>
  )
}

export default DonationPreview