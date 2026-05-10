import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SpeedOutlinedIcon from '@mui/icons-material/SpeedOutlined';
import CheckIcon from '@mui/icons-material/Check';
import { API_BASE, FORM_FIELD_TINT_BG, ORACLE_RED_ACTION } from './constants/sprintConstants';
import { newSprintDialogFieldOutline, oracleRgba } from './utils/sprintUtils';

export function NewSprintDialog({ open, onClose, onCreated, projectId }) {
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [goal, setGoal] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const resolvedProjectId = projectId == null || projectId === '' ? NaN : Number(projectId);
  const hasValidProject = Number.isFinite(resolvedProjectId) && resolvedProjectId > 0;

  useEffect(() => {
    if (!open) return;
    setStartDate('');
    setDueDate('');
    setGoal('');
    setSaveError('');
  }, [open]);

  const handleClose = () => {
    if (!saving) onClose();
  };

  const handleSave = async () => {
    if (!hasValidProject || !startDate || !dueDate) return;
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch(`${API_BASE}/api/sprints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedProject: { id: resolvedProjectId },
          startDate: new Date(startDate).toISOString(),
          dueDate: new Date(dueDate).toISOString(),
          completionRate: 0,
          onTimeDelivery: 0,
          teamParticipation: 0,
          workloadBalance: 0,
          goal: goal.trim() || null,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        onCreated(created);
        handleClose();
        return;
      }
      const errText = (await res.text()).trim() || `Request failed (${res.status})`;
      setSaveError(errText);
    } catch (e) {
      setSaveError(
        e?.message || 'Could not reach the server. Is the backend running on port 8080?',
      );
    } finally {
      setSaving(false);
    }
  };

  const canSave = Boolean(hasValidProject && startDate && dueDate);

  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: '8px',
      fontSize: 15,
      bgcolor: FORM_FIELD_TINT_BG,
      '& input, & textarea, & .MuiSelect-select': { fontSize: 15, bgcolor: 'transparent' },
      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#C74126' },
      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
        borderColor: '#C74126',
        boxShadow: '0 0 0 3px rgba(199,65,38,0.08)',
      },
    },
    '& .MuiInputLabel-root': { fontSize: 15 },
    '& .MuiInputLabel-root.Mui-focused': { color: '#C74126' },
    '& .MuiFormHelperText-root': { fontSize: 13 },
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        elevation: 0,
        sx: {
          borderRadius: '16px',
          border: '1px solid #ECECEC',
          bgcolor: '#FFFFFF',
          overflow: 'hidden',
          maxWidth: { xs: 'calc(100% - 24px)', sm: 560 },
        },
      }}
    >
      {/* Header */}
      <DialogTitle sx={{ p: 0 }}>
        <Box
          sx={{
            bgcolor: ORACLE_RED_ACTION,
            px: 2.5,
            pt: 2,
            pb: 1.75,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: '10px',
                bgcolor: 'rgba(255,255,255,0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <SpeedOutlinedIcon sx={{ color: '#fff', fontSize: 20 }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 600, color: '#fff', fontSize: 16, lineHeight: 1.2 }}>
                New sprint
              </Typography>
              <Typography sx={{ fontSize: 14, color: 'rgba(255,255,255,0.72)', display: 'block' }}>
                Schedule & goal
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={handleClose}
            disabled={saving}
            size="small"
            sx={{
              color: 'rgba(255,255,255,0.85)',
              border: '1px solid rgba(255,255,255,0.3)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>

      {/* Body */}
      <DialogContent sx={{ pt: '32px !important', px: 3, pb: 2, overflowY: 'auto' }}>
        <Typography sx={{ fontSize: 15, color: '#424242', mb: 2.5 }}>
          Pick start and end dates, then add an optional sprint goal.
        </Typography>

        {!hasValidProject && (
          <Typography sx={{ fontSize: 13, color: ORACLE_RED_ACTION, fontWeight: 600, display: 'block', mb: 1.5 }}>
            No active project is selected. Select a project in the app or sign in again.
          </Typography>
        )}

        {saveError && (
          <Typography
            sx={{
              fontSize: 13,
              color: ORACLE_RED_ACTION,
              fontWeight: 600,
              display: 'block',
              mb: 1.5,
              whiteSpace: 'pre-wrap',
            }}
          >
            {saveError}
          </Typography>
        )}

        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              label="Start date *"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              size="small"
              sx={fieldSx}
            />
            <TextField
              label="End date *"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              size="small"
              sx={fieldSx}
            />
          </Stack>
          <TextField
            label="Sprint goal (optional)"
            placeholder="What should this sprint achieve?"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            fullWidth
            multiline
            minRows={4}
            inputProps={{ maxLength: 2000 }}
            helperText={`${goal.length} / 2000 characters`}
            sx={fieldSx}
          />
        </Stack>
      </DialogContent>

      {/* Footer */}
      <DialogActions
        sx={{
          px: 3,
          py: 1.5,
          gap: 1,
          borderTop: '1px solid #F0F0F0',
          bgcolor: '#FAFAFA',
          justifyContent: 'space-between',
        }}
      >
        <Typography sx={{ fontSize: 13, color: 'text.disabled' }}>
          Fields marked with{' '}
          <Box component="span" sx={{ color: ORACLE_RED_ACTION, fontWeight: 700 }}>*</Box>
          {' '}are required
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            onClick={handleClose}
            disabled={saving}
            sx={{
              fontSize: 14,
              color: 'text.secondary',
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: '8px',
              border: '1px solid #E0E0E0',
              px: 2,
              '&:hover': { bgcolor: '#F5F5F5' },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !canSave}
            variant="contained"
            disableElevation
            startIcon={<CheckIcon sx={{ fontSize: '18px !important' }} />}
            sx={{
              fontSize: 14,
              bgcolor: ORACLE_RED_ACTION,
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: '8px',
              px: 2.5,
              '&:hover': { bgcolor: '#A83B2D' },
              '&.Mui-disabled': { bgcolor: '#EFEBE9', color: '#BCAAA4' },
            }}
          >
            {saving ? 'Creating…' : 'Create sprint'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}