import { createTheme, type Theme } from '@mui/material/styles'
import { clientConfig } from './config/clientConfig'

declare module '@mui/material/styles' {
  interface Palette {
    brand: {
      teal: string
      aqua: string
      dark: string
    }
  }
  interface PaletteOptions {
    brand?: {
      teal?: string
      aqua?: string
      dark?: string
    }
  }
}

export function createAppTheme(): Theme {
  const primary = clientConfig.primaryColor
  const secondary = clientConfig.secondaryColor
  const dark = clientConfig.brandDark

  return createTheme({
    palette: {
      primary: { main: primary },
      secondary: { main: secondary },
      text: { primary: '#1F2937' },
      background: { default: '#ffffff' },
      brand: {
        teal: secondary,
        aqua: primary,
        dark,
      },
    },
    typography: {
      fontFamily: `'Inter', system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Apple Color Emoji','Segoe UI Emoji'`,
      h2: { fontWeight: 900, letterSpacing: '-0.02em' },
      h4: { fontWeight: 800 },
      button: { textTransform: 'none', fontWeight: 700 },
    },
    shape: { borderRadius: 14 },
    components: {
      MuiButton: {
        styleOverrides: {
          root: { borderRadius: 40, paddingInline: 22, paddingBlock: 10 },
        },
      },
      MuiPaper: {
        styleOverrides: { root: { borderRadius: 20 } },
      },
    },
  })
}
