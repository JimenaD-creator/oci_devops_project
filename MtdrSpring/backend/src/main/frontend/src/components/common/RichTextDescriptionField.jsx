import React, { useCallback, useEffect, useRef } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import { sanitizeRichDescriptionHtml } from '../../utils/richTextDescriptionUtils';

function exec(cmd, value = null) {
  try {
    document.execCommand(cmd, false, value);
  } catch {
    /* ignore unsupported commands */
  }
}

export default function RichTextDescriptionField({
  label = 'Description',
  value,
  onChange,
  minRows = 3,
  required = false,
  disabled = false,
  sx = {},
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const editorRef = useRef(null);

  const syncFromValue = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const next = sanitizeRichDescriptionHtml(value || '');
    if (el.innerHTML !== next) {
      el.innerHTML = next;
    }
  }, [value]);

  useEffect(() => {
    syncFromValue();
  }, [syncFromValue]);

  const emitChange = () => {
    const el = editorRef.current;
    if (!el) return;
    const html = sanitizeRichDescriptionHtml(el.innerHTML);
    onChange?.(html);
  };

  const handleToolbar = (e, command) => {
    e.preventDefault();
    editorRef.current?.focus();
    if (command === 'insertUnorderedList') {
      exec('insertUnorderedList');
    } else {
      exec(command);
    }
    emitChange();
  };

  const minHeight = Math.max(72, minRows * 24);

  return (
    <Box sx={sx}>
      <Typography
        component="label"
        sx={{
          display: 'block',
          fontSize: 12,
          fontWeight: 600,
          color: 'text.secondary',
          mb: 0.75,
        }}
      >
        {label}
        {required ? ' *' : ''}
      </Typography>
      <Box
        sx={{
          border: '1px solid',
          borderColor: isDark ? 'rgba(255,255,255,0.23)' : 'rgba(0,0,0,0.23)',
          borderRadius: 1,
          overflow: 'hidden',
          bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'background.paper',
          opacity: disabled ? 0.6 : 1,
          pointerEvents: disabled ? 'none' : 'auto',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.25,
            px: 0.5,
            py: 0.25,
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
          }}
        >
          <IconButton
            size="small"
            aria-label="Bold"
            onMouseDown={(e) => handleToolbar(e, 'bold')}
            sx={{ color: 'text.secondary' }}
          >
            <FormatBoldIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            aria-label="Italic"
            onMouseDown={(e) => handleToolbar(e, 'italic')}
            sx={{ color: 'text.secondary' }}
          >
            <FormatItalicIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            aria-label="Underline"
            onMouseDown={(e) => handleToolbar(e, 'underline')}
            sx={{ color: 'text.secondary' }}
          >
            <FormatUnderlinedIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            aria-label="Bullet list"
            onMouseDown={(e) => handleToolbar(e, 'insertUnorderedList')}
            sx={{ color: 'text.secondary' }}
          >
            <FormatListBulletedIcon fontSize="small" />
          </IconButton>
        </Box>
        <Box
          ref={editorRef}
          contentEditable={!disabled}
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={label}
          data-placeholder="Describe the task…"
          onInput={emitChange}
          onBlur={emitChange}
          sx={{
            minHeight,
            px: 1.5,
            py: 1.25,
            fontSize: 14,
            lineHeight: 1.5,
            color: 'text.primary',
            outline: 'none',
            '&:empty:before': {
              content: 'attr(data-placeholder)',
              color: 'text.disabled',
              pointerEvents: 'none',
            },
            '& ul': { pl: 2.5, my: 0.5 },
            '& ol': { pl: 2.5, my: 0.5 },
          }}
        />
      </Box>
    </Box>
  );
}
