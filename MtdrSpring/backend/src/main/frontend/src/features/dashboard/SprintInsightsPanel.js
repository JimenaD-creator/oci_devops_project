import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';

export default function SprintInsightsPanel({ insights, visible }) {
  if (!visible || !insights?.length) return null;
  return (
    <Paper
      sx={{
        p: 2.5,
        mb: 3,
        borderRadius: 3,
        border: '1px solid #EFEFEF',
        boxShadow: 'none',
        borderLeft: '4px solid #C74634',
        bgcolor: '#FFFAFA',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <LightbulbOutlinedIcon sx={{ color: '#C74634', fontSize: 22 }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1A1A1A' }}>
          Sprint comparison insights
        </Typography>
      </Box>
      <Box component="ul" sx={{ m: 0, pl: 2.5, '& li': { mb: 1, color: '#444', fontSize: '0.875rem', lineHeight: 1.5 } }}>
        {insights.map((text, i) => (
          <li key={i}>{text}</li>
        ))}
      </Box>
    </Paper>
  );
}
