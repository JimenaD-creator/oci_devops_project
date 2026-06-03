import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  Box,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { ORACLE_RED } from './constants/taskConstants';
import { ORACLE_RED_ACTION } from '../sprints/constants/sprintConstants';

export default function LogWorkedHoursDialog({
  open,
  taskTitle = '',
  initialHours = '',
  onConfirm,
  onCancel,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (open) {
      setValue(initialHours === '' || initialHours == null ? '' : String(initialHours));
      setError('');
      setIsSending(false);
    }
  }, [open, initialHours]);

  const handleConfirm = () => {
    const hours = Number(value);
    if (!Number.isFinite(hours) || hours < 0) {
      setError('Enter a valid number of hours (0 or greater).');
      return;
    }
    setIsSending(true);
    void Promise.resolve(onConfirm(hours)).catch(() => {
      setIsSending(false);
    });
  };

  return (
    <Dialog
      open={open}
      onClose={isSending ? undefined : onCancel}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          bgcolor: 'background.paper',
        },
      }}
    >
      <DialogTitle sx={{ p: 0 }}>
        <Box
          sx={{
            bgcolor: ORACLE_RED_ACTION,
            px: 2.5,
            py: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '10px',
              bgcolor: 'rgba(255,255,255,0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AccessTimeIcon sx={{ color: '#fff', fontSize: 20 }} />
          </Box>
          <Typography sx={{ fontWeight: 600, color: '#fff', fontSize: '1.05rem', lineHeight: 1.3 }}>
            Log hours worked
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent
        sx={{
          pt: '28px !important',
          px: 2.5,
          pb: 1,
          overflow: 'visible',
        }}
      >
        <Typography variant="body2" sx={{ mb: 2.5, color: 'text.primary', lineHeight: 1.5 }}>
          {taskTitle ? (
            <>
              Task:{' '}
              <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
                {taskTitle}
              </Box>
            </>
          ) : (
            'How many hours did you spend on this task?'
          )}
        </Typography>
        <TextField
          autoFocus
          label="Hours worked"
          type="number"
          inputProps={{ min: 0, step: 0.25 }}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError('');
          }}
          fullWidth
          size="small"
          error={Boolean(error)}
          helperText={error || 'Total hours for this assignment.'}
        />
        <Alert
          severity="info"
          sx={{
            mt: 2,
            border: 'none',
            bgcolor: isDark ? 'rgba(199, 70, 52, 0.16)' : 'rgba(199, 70, 52, 0.1)',
            color: 'text.primary',
            '& .MuiAlert-icon': { color: ORACLE_RED },
          }}
        >
          This is saved on your own assignment.
        </Alert>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2.5, pt: 0, gap: 1 }}>
        <Button
          onClick={onCancel}
          disabled={isSending}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            color: 'text.secondary',
            borderRadius: '8px',
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          disableElevation
          onClick={handleConfirm}
          disabled={isSending}
          startIcon={isSending ? <CircularProgress size={18} color="inherit" /> : null}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: '8px',
            bgcolor: ORACLE_RED_ACTION,
            color: '#fff',
            px: 2.5,
            '&:hover': { bgcolor: '#A83B2D' },
            '&.Mui-disabled': {
              bgcolor: isDark ? 'rgba(199, 70, 52, 0.35)' : '#EFEBE9',
              color: isDark ? 'rgba(255,255,255,0.5)' : '#BCAAA4',
            },
          }}
        >
          Mark done
        </Button>
      </DialogActions>
    </Dialog>
  );
}
