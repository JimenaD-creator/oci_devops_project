import React from 'react';
import { Box, CircularProgress } from '@mui/material';
import { ORACLE_RED_ACTION } from '../../features/sprints/constants/sprintConstants';

/** Centered page loader — use on every feature page while initial data loads. */
export default function PageLoadingSpinner({
  color = ORACLE_RED_ACTION,
  minHeight = '60vh',
  size,
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight,
        width: '100%',
      }}
    >
      <CircularProgress size={size} sx={{ color }} />
    </Box>
  );
}
