// frontend/src/theme.ts
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#73C3C9', // <= your turquoise button color
    },
  },
  // (Optional) make all Buttons "contained" and use primary by default:
  components: {
    MuiButton: {
      defaultProps: {
        color: 'primary',
        variant: 'contained',
      },
    },
  },
});

export default theme;