import React, { useState } from 'react'
import UploadDropzone from '../components/UploadDropzone'
import { uploadFile } from '../services/upload'
import { getToken } from '../auth/authService'
import { Container, Typography, List, ListItem } from '@mui/material'

const UploadFilesToBackend: React.FC = () => {
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([])

  const handleUpload = async (files: File[]) => {
    const token = getToken()
    if (!token) return alert('Nejste přihlášen')

    const results: string[] = []
    for (const file of files) {
      try {
        const url = await uploadFile(file, token)
        results.push(url)
      } catch (e) {
        console.error('Upload error:', e)
      }
    }
    setUploadedUrls(results)
  }

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h5" gutterBottom>Nahrát soubory</Typography>
      <UploadDropzone onFilesAccepted={handleUpload} />
      <List>
        {uploadedUrls.map((url, i) => (
          <ListItem key={i}>{url}</ListItem>
        ))}
      </List>
    </Container>
  )
}

export default UploadFilesToBackend