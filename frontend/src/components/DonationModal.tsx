import React from 'react'
import { Modal, Box, Typography, Button, TextField } from '@mui/material'

interface DonationModalProps {
  open: boolean
  onClose: () => void
}

const DonationModal: React.FC<DonationModalProps> = ({ open, onClose }) => {
  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={{ width: 400, mx: 'auto', mt: 10, bgcolor: 'background.paper', p: 4, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom>Darovat</Typography>
        <TextField fullWidth label="Částka v Kč" type="number" margin="normal" />
        <Button fullWidth variant="contained" sx={{ mt: 2 }}>Pokračovat k platbě</Button>
      </Box>
    </Modal>
  )
}

export default DonationModal