import { createTheme } from '@mui/material/styles';

export const APP_FONT_FAMILY =
  "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Helvetica Neue', sans-serif";

const baseComponents = {
  MuiInputBase: { styleOverrides: { root: { fontFamily: APP_FONT_FAMILY } } },
  MuiInputLabel: { styleOverrides: { root: { fontFamily: APP_FONT_FAMILY } } },
  MuiMenuItem: { styleOverrides: { root: { fontFamily: APP_FONT_FAMILY } } },
  MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
};

export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    background: { default: '#F7F8FA', paper: '#FFFFFF' },
    text: { primary: '#1A1A1A', secondary: '#757575' },
  },
  typography: { fontFamily: APP_FONT_FAMILY },
  components: baseComponents,
});

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: { default: '#111214', paper: '#1C1E22' },
    text: { primary: '#F0F0F0', secondary: '#9A9A9A' },
  },
  typography: { fontFamily: APP_FONT_FAMILY },
  components: baseComponents,
});

// Compatibilidad con imports viejos
export const appTheme = lightTheme;
