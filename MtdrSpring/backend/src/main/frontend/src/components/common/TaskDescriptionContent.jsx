import React from 'react';
import { Box, Typography } from '@mui/material';
import {
  looksLikeRichDescriptionHtml,
  richDescriptionPlainText,
  richDescriptionViewSx,
  sanitizeRichDescriptionHtml,
} from '../../utils/richTextDescriptionUtils';

export default function TaskDescriptionContent({ description, sx = {} }) {
  const raw = description != null ? String(description) : '';
  const trimmed = raw.trim();
  if (!trimmed) {
    return (
      <Typography sx={{ fontSize: 13, color: 'text.secondary', ...sx }}>—</Typography>
    );
  }
  if (looksLikeRichDescriptionHtml(trimmed)) {
    return (
      <Box
        sx={{ ...richDescriptionViewSx, ...sx }}
        dangerouslySetInnerHTML={{ __html: sanitizeRichDescriptionHtml(trimmed) }}
      />
    );
  }
  return (
    <Typography sx={{ fontSize: 13, color: 'text.secondary', whiteSpace: 'pre-wrap', ...sx }}>
      {trimmed}
    </Typography>
  );
}

export { richDescriptionPlainText };
