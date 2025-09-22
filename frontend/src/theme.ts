// frontend/src/theme.ts
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#73C3C9',   // turquoise
      contrastText: '#ffffff', // <-- ensure white text on primary
    },
  },
  components: {
    MuiButton: {
      defaultProps: {
        color: 'primary',
        variant: 'contained',
      },
      styleOverrides: {
        root: {
          color: '#ffffff', // <-- white text
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
              color: '#ffffff', // <-- white font inside input
              backgroundColor: '#73C3C9', // turquoise background
            },
          },
        },
      },
    },
  },
});

export default theme;