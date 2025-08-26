import React, { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Box, Typography } from '@mui/material'

interface UploadDropzoneProps {
  onFilesAccepted: (files: File[]) => void
}

const UploadDropzone: React.FC<UploadDropzoneProps> = ({ onFilesAccepted }) => {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    onFilesAccepted(acceptedFiles)
  }, [onFilesAccepted])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop })

  return (
    <Box
      {...getRootProps()}
      sx={{
        border: '2px dashed #ccc',
        borderRadius: 2,
        p: 4,
        textAlign: 'center',
        bgcolor: isDragActive ? '#f0f0f0' : 'inherit',
        cursor: 'pointer'
      }}
    >
      <input {...getInputProps()} />
      <Typography>
        {isDragActive ? 'Pusťte soubory sem...' : 'Přetáhněte sem fotky nebo klikněte pro výběr'}
      </Typography>
    </Box>
  )
}

export default UploadDropzone