import { createTheme } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette {
    brand: {
      teal: string;
      aqua: string;
      dark: string;
    };
  }
  interface PaletteOptions {
    brand?: {
      teal?: string;
      aqua?: string;
      dark?: string;
    };
  }
}

const theme = createTheme({
  palette: {
    primary: { main: '#00B3B8' }, // aqua
    secondary: { main: '#00A0A6' }, // teal
    text: { primary: '#1F2937' },
    background: { default: '#ffffff' },
    brand: {
      teal: '#00A0A6',
      aqua: '#00B3B8',
      dark: '#0F172A',
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
});

export default theme;