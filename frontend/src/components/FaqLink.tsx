import { Link as RouterLink } from 'react-router-dom'
import Typography from '@mui/material/Typography'
import type { SxProps, Theme } from '@mui/material/styles'

type Props = {
  children?: React.ReactNode
  sx?: SxProps<Theme>
}

/**
 * Link to `/caste-dotazy`. Uses RouterLink + Typography so the route always works
 * and the text stays clearly visible (underline + bold primary).
 */
export default function FaqLink({ children = 'Časté dotazy', sx }: Props) {
  return (
    <Typography
      component={RouterLink}
      to="/caste-dotazy"
      variant="inherit"
      sx={{
        color: 'primary.main',
        fontWeight: 700,
        textDecoration: 'underline',
        textUnderlineOffset: '3px',
        cursor: 'pointer',
        '&:hover': {
          color: 'primary.dark',
        },
        ...sx,
      }}
    >
      {children}
    </Typography>
  )
}
