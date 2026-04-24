import React from 'react';
import { Box, Chip } from '@mui/material';
import { alpha } from '@mui/material/styles';

/** When a sprint has no accent color yet, cycle these (aligned with chart sprint colors). */
const COMPARE_FALLBACK_ACCENTS = ['#1565C0', '#C62828', '#2E7D32', '#6A1B9A', '#F57C00', '#00897B'];

/**
 * Task-table DONE count per sprint (`totalCompleted`), not a sum of per-dev USER_TASK rows.
 *
 * @param {{ accent?: string, count?: number, compareBySprint?: { id: number, shortLabel: string, completed: number, accentColor?: string }[], pillTestId?: string }} props
 */
export default function DashboardCompletedTasksPills({
  accent,
  count = 0,
  compareBySprint,
  pillTestId = 'dashboard-tasks-completed-pill',
}) {
  const defaultAccent = accent ?? '#3949AB';
  const nCompare = compareBySprint?.length ?? 0;
  if (compareBySprint?.length) {
    return (
      <Box
        sx={{
          display: 'grid',
          width: '100%',
          boxSizing: 'border-box',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          gap: { xs: 0.75, sm: 1 },
        }}
      >
        {compareBySprint.map((b, idx) => {
          const chipAccent =
            b.accentColor ||
            COMPARE_FALLBACK_ACCENTS[idx % COMPARE_FALLBACK_ACCENTS.length] ||
            defaultAccent;
          return (
            <Box key={b.id} sx={{ minWidth: 0 }}>
              <Chip
                data-testid={pillTestId}
                data-sprint-id={String(b.id)}
                size="small"
                label={`${b.shortLabel}: ${b.completed} tasks completed`}
                sx={{
                  width: '100%',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize:
                    nCompare > 4
                      ? { xs: '0.6875rem', sm: '0.72rem' }
                      : { xs: '0.75rem', sm: '0.8rem' },
                  minHeight: nCompare > 4 ? { xs: 30, sm: 32 } : { xs: 32, sm: 34 },
                  height: 'auto',
                  py: 0.5,
                  '& .MuiChip-label': {
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    textAlign: 'center',
                    lineHeight: 1.25,
                    px: 1,
                  },
                  borderColor: chipAccent,
                  color: chipAccent,
                  bgcolor: alpha(chipAccent, 0.08),
                }}
                variant="outlined"
              />
            </Box>
          );
        })}
      </Box>
    );
  }
  return (
    <Chip
      data-testid={pillTestId}
      size="small"
      label={`${count} tasks completed`}
      sx={{
        fontWeight: 700,
        fontSize: '0.8125rem',
        height: 30,
        borderColor: defaultAccent,
        color: defaultAccent,
        bgcolor: alpha(defaultAccent, 0.08),
      }}
      variant="outlined"
    />
  );
}
