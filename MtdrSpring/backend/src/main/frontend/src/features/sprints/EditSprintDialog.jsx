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
import { useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import SpeedOutlinedIcon from '@mui/icons-material/SpeedOutlined';
import { API_BASE, ORACLE_RED_ACTION } from './constants/sprintConstants';
import { sprintKpiNumber, toInputDate } from './utils/sprintUtils';

export function EditSprintDialog({ open, sprint, onClose, onSaved }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
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

  // Función para obtener el color RGBA dinámico según el tema
  const getOracleRgba = (opacity) => {
    if (isDark) return `rgba(199, 70, 52, ${opacity * 0.8})`;
    return oracleRgba(opacity);
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
          borderRadius: 3,
          border: `1px solid ${isDark ? '#2A2C32' : '#ECECEC'}`,
          borderLeft: `4px solid ${ORACLE_RED_ACTION}`,
          bgcolor: 'background.paper',
          boxShadow: isDark 
            ? `0 16px 40px rgba(0,0,0,0.3)`
            : `0 16px 40px ${oracleRgba(0.1)}, 0 8px 24px rgba(30, 136, 229, 0.08)`,
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
            gap: 2,
            px: 2.5,
            pt: 2.5,
            pb: 2,
            borderBottom: `1px solid ${getOracleRgba(0.12)}`,
            backgroundColor: 'background.paper',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                bgcolor: getOracleRgba(0.12),
                border: `1px solid ${getOracleRgba(0.2)}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <SpeedOutlinedIcon sx={{ color: '#fff', fontSize: 20 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                sx={{
                  fontWeight: 800,
                  color: 'text.primary',
                  lineHeight: 1.25,
                  fontSize: '1.3rem',
                  letterSpacing: '-0.02em',
                }}
              >
                Edit sprint{sprint?.id != null ? ` #${sprint.id}` : ''}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mt: 0.35 }}
              >
                Dates & goal
              </Typography>
            </Box>
          </Box>
          <IconButton
            aria-label="Close"
            onClick={handleClose}
            disabled={saving}
            size="small"
            sx={{ color: 'text.secondary', '&:hover': { bgcolor: getOracleRgba(0.08) } }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent
        sx={{
          px: 2.5,
          pt: 2.25,
          pb: 1.5,
          backgroundColor: 'background.paper',
        }}
      >
        <Typography
          variant="body2"
          sx={{ color: isDark ? '#9A9A9A' : '#424242', fontWeight: 600, lineHeight: 1.5, mb: 2 }}
        >
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
          borderTop: `1px solid ${getOracleRgba(0.12)}`,
          backgroundColor: 'background.paper',
          justifyContent: 'flex-end',
        }}
      >
        <Button
          onClick={handleClose}
          disabled={saving}
          sx={{ color: 'text.secondary', textTransform: 'none', fontWeight: 600, px: 2 }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || !canSave}
          variant="contained"
          disableElevation
          sx={{
            bgcolor: ORACLE_RED_ACTION,
            textTransform: 'none',
            fontWeight: 700,
            px: 2.5,
            borderRadius: 2,
            '&:hover': { bgcolor: '#A83B2D' },
            '&.Mui-disabled': { bgcolor: isDark ? '#2A2C32' : '#E0E0E0', color: isDark ? '#5A5A5A' : '#9E9E9E' },
          }}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}