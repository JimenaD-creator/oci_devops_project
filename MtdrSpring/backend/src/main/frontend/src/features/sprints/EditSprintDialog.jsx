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
import CheckIcon from '@mui/icons-material/Check';
import SpeedOutlinedIcon from '@mui/icons-material/SpeedOutlined';
import { API_BASE, ORACLE_RED_ACTION } from './constants/sprintConstants';
import { sprintKpiNumber, toInputDate } from './utils/sprintUtils';

export function EditSprintDialog({ open, sprint, onClose, onSaved }) {
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [goal, setGoal] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !sprint) return;
    setStartDate(toInputDate(sprint.startDate));
    setDueDate(toInputDate(sprint.dueDate));
    setGoal(typeof sprint.goal === 'string' ? sprint.goal : '');
    setError('');
  }, [open, sprint]);

  const handleClose = () => {
    if (!saving) onClose();
  };

  const sprintId =
    sprint?.id == null || sprint?.id === ''
      ? null
      : Number.isFinite(Number(sprint.id))
        ? Number(sprint.id)
        : null;

  const handleSave = async () => {
    if (sprintId == null || !startDate || !dueDate) return;
    const projectIdRaw = sprint?.assignedProject?.id ?? sprint?.assignedProject?.ID;
    const projectId =
      projectIdRaw == null || projectIdRaw === ''
        ? null
        : Number.isFinite(Number(projectIdRaw))
          ? Number(projectIdRaw)
          : null;
    if (projectId == null) {
      setError('Sprint project is missing. Please refresh and try again.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const goalTrim = goal.trim();
      const res = await fetch(`${API_BASE}/api/sprints/${sprintId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedProject: { id: projectId },
          startDate: new Date(startDate).toISOString(),
          dueDate: new Date(dueDate).toISOString(),
          completionRate: sprintKpiNumber(sprint, 'completionRate'),
          onTimeDelivery: sprintKpiNumber(sprint, 'onTimeDelivery'),
          teamParticipation: sprintKpiNumber(sprint, 'teamParticipation'),
          workloadBalance: sprintKpiNumber(sprint, 'workloadBalance'),
          goal: goalTrim || null,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        onSaved(updated);
        onClose();
      } else {
        let detail = '';
        try {
          detail = (await res.text()).trim();
        } catch {
          detail = '';
        }
        if (res.status === 404) {
          setError(`Sprint #${sprintId} was not found in the API.`);
        } else if (detail) {
          setError(`Could not save sprint changes (${res.status}): ${detail}`);
        } else {
          setError(`Could not save sprint changes (${res.status}).`);
        }
      }
    } catch {
      setError('Connection error.');
    } finally {
      setSaving(false);
    }
  };

  const canSave = Boolean(startDate && dueDate && sprintId != null);

  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: '8px',
      fontSize: 13,
      '& input, & textarea, & .MuiSelect-select': { fontSize: 13 },
      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#C74126' },
      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
        borderColor: '#C74126',
        boxShadow: '0 0 0 3px rgba(199,65,38,0.08)',
      },
    },
    '& .MuiInputLabel-root': { fontSize: 13 },
    '& .MuiInputLabel-root.Mui-focused': { color: '#C74126' },
    '& .MuiFormHelperText-root': { fontSize: 12 },
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      scroll="body"
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
              <Typography sx={{ fontWeight: 600, color: '#fff', fontSize: 15, lineHeight: 1.2 }}>
                Edit sprint{sprintId != null ? ` #${sprintId}` : ''}
              </Typography>
              <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', display: 'block' }}>
                Dates & goal
              </Typography>
            </Box>
          </Box>
          <IconButton
            aria-label="Close"
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
        <Typography sx={{ fontSize: 13, color: '#424242', mb: 2.5, lineHeight: 1.5 }}>
          Update the sprint window and optional goal. KPI metrics stored in the database are kept
          as-is.
        </Typography>

        {error && (
          <Typography
            sx={{
              fontSize: 12,
              color: ORACLE_RED_ACTION,
              fontWeight: 600,
              display: 'block',
              mb: 1.5,
            }}
          >
            {error}
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
            sx={{
              ...fieldSx,
              '& .MuiOutlinedInput-root': {
                ...fieldSx['& .MuiOutlinedInput-root'],
                alignItems: 'flex-start',
              },
            }}
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
        <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>
          Fields marked with{' '}
          <Box component="span" sx={{ color: ORACLE_RED_ACTION, fontWeight: 700 }}>
            *
          </Box>{' '}
          are required
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            onClick={handleClose}
            disabled={saving}
            sx={{
              fontSize: 13,
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
            startIcon={<CheckIcon sx={{ fontSize: '16px !important' }} />}
            sx={{
              fontSize: 13,
              bgcolor: ORACLE_RED_ACTION,
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: '8px',
              px: 2.5,
              '&:hover': { bgcolor: '#A83B2D' },
              '&.Mui-disabled': { bgcolor: '#EFEBE9', color: '#BCAAA4' },
            }}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
