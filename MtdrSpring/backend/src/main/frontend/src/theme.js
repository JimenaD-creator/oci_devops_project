import { createTheme } from '@mui/material/styles';

/** Same stack as index.css (DM Sans is loaded via Google Fonts). */
export const APP_FONT_FAMILY =
  "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Helvetica Neue', sans-serif";

export const appTheme = createTheme({
  typography: {
    fontFamily: APP_FONT_FAMILY,
  },
  components: {
    MuiInputBase: {
      styleOverrides: {
        root: {
          fontFamily: APP_FONT_FAMILY,
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontFamily: APP_FONT_FAMILY,
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontFamily: APP_FONT_FAMILY,
        },
      },
    },
  },
});
