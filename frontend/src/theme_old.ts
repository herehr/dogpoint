// frontend/src/theme.ts
import { createTheme, alpha } from '@mui/material/styles';

const text50 = 'rgba(0,0,0,0.5)';   // 50% black
const text70 = 'rgba(0,0,0,0.7)';   // hover/focus

const theme = createTheme({
  palette: {
    primary: {
      main: '#73C3C9',      // turquoise
      contrastText: '#ffffff', // NOTE: default for contained, we'll override below
    },
  },
  components: {
    MuiButton: {
      defaultProps: {
        color: 'primary',
        variant: 'contained',
      },
      styleOverrides: {
        // Applies to ALL buttons (baseline)
        root: {
          // fallback text color (will be overridden by variant-specific rules below)
          color: text50,
          textTransform: 'none',
          fontWeight: 700,
        },

        // Contained buttons (primary background)
        contained: {
          color: text50, // override contrastText (white) → use 50% black
          // optional: slightly stronger on hover/focus for readability
          '&:hover': { color: text70, backgroundColor: alpha('#73C3C9', 0.9) },
          '&:focus-visible': { color: text70 },
        },

        // Outlined buttons
        outlined: {
          color: text50,
          borderColor: alpha('#000', 0.25),
          '&:hover': {
            color: text70,
            borderColor: alpha('#000', 0.4),
            backgroundColor: alpha('#000', 0.04),
          },
          '&:focus-visible': { color: text70 },
        },

        // Text buttons (if you use them)
        text: {
          color: text50,
          '&:hover': { color: text70, backgroundColor: alpha('#000', 0.04) },
          '&:focus-visible': { color: text70 },
        },
      },
    },

    MuiTextField: {
      styleOverrides: {
        root: {
          '& label.Mui-focused': {
            color: '#73C3C9', // label when active
          },
          '& .MuiOutlinedInput-root': {
            '& fieldset': {
              borderColor: '#73C3C9',
            },
            '&:hover fieldset': {
              borderColor: '#73C3C9',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#73C3C9',
            },
            '& input': {
              color: '#ffffff',            // white font inside input
              backgroundColor: '#73C3C9',  // turquoise background
            },
          },
        },
      },
    },
  },
});

export default theme;