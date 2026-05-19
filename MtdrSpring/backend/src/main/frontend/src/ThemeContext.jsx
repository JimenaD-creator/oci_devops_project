import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { lightTheme, darkTheme } from './theme';

const ThemeContext = createContext({
  darkMode: false,
  toggleDark: () => {},
});

export function useThemeMode() {
  return useContext(ThemeContext);
}

export function AppThemeProvider({ children }) {
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem('darkMode') === 'true'
  );

  const toggleDark = () => {
    setDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem('darkMode', String(next));
      return next;
    });
  };

  // Pone data-mui-color-scheme en <html> para que el CSS lo lea
  useEffect(() => {
    document.documentElement.setAttribute(
      'data-mui-color-scheme',
      darkMode ? 'dark' : 'light'
    );
    // También body background para evitar flash de blanco
    document.body.style.backgroundColor = darkMode ? '#111214' : '#F7F8FA';
  }, [darkMode]);

  const value = useMemo(() => ({ darkMode, toggleDark }), [darkMode]);

  return (
    <ThemeContext.Provider value={value}>
      <ThemeProvider theme={darkMode ? darkTheme : lightTheme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
}