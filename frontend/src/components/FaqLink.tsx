import { Link as RouterLink } from 'react-router-dom'
import MuiLink from '@mui/material/Link'
import type { SxProps, Theme } from '@mui/material/styles'

type Props = {
  children?: React.ReactNode
  sx?: SxProps<Theme>
}

/** Link to `/caste-dotazy` (FAQ). Use short labels in context, e.g. „Časté dotazy“, „Nápověda“. */
export default function FaqLink({ children = 'Časté dotazy', sx }: Props) {
  return (
    <MuiLink component={RouterLink} to="/caste-dotazy" underline="hover" color="primary" sx={sx}>
      {children}
    </MuiLink>
  )
}
