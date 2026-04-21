import React from 'react';
import { render } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { appTheme } from './theme';

/** MUI components (Select, Dialog) need ThemeProvider in Jest. */
export function renderWithTheme(ui, options) {
  return render(<ThemeProvider theme={appTheme}>{ui}</ThemeProvider>, options);
}
