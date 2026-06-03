import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { CalendarOff } from 'lucide-react';
import { ORACLE_RED } from '../tasks/constants/taskConstants';

/**
 * Shown on developer pages when the project has no sprints (or nothing to show yet).
 */
export default function DeveloperEmptyState({
  pageTitle,
  description = 'There are no sprints or information available in this project yet. Ask your manager to create sprints and assign you tasks.',
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const borderColor = isDark ? '#2A2C32' : '#ECECEC';

  return (
    <Paper
      elevation={0}
      sx={{
        mt: pageTitle ? 0 : 2,
        p: { xs: 3, md: 4.5 },
        borderRadius: 3,
        border: `1px solid ${borderColor}`,
        bgcolor: 'background.paper',
        textAlign: 'center',
      }}
    >
      <Box
        sx={{
          width: 56,
          height: 56,
          mx: 'auto',
          mb: 2,
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: isDark ? 'rgba(199, 70, 52, 0.14)' : 'rgba(199, 70, 52, 0.08)',
        }}
      >
        <CalendarOff size={28} color={ORACLE_RED} strokeWidth={2} />
      </Box>
      {pageTitle ? (
        <Typography
          variant="overline"
          sx={{
            display: 'block',
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: 'text.secondary',
            mb: 0.75,
          }}
        >
          {pageTitle}
        </Typography>
      ) : null}
      <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', mb: 1 }}>
        No sprints or information available
      </Typography>
      <Typography
        sx={{
          color: 'text.secondary',
          maxWidth: 520,
          mx: 'auto',
          fontSize: '0.95rem',
          lineHeight: 1.55,
        }}
      >
        {description}
      </Typography>
    </Paper>
  );
}
