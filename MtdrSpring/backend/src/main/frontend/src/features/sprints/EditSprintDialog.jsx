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
import EditIcon from '@mui/icons-material/Edit';
import { API_BASE, ORACLE_RED_ACTION } from './constants/sprintConstants';
import {
  newSprintDialogFieldOutline,
  oracleRgba,
  sprintKpiNumber,
  toInputDate,
} from './utils/sprintUtils';

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
          border: '1px solid #ECECEC',
          borderLeft: `4px solid ${ORACLE_RED_ACTION}`,
          bgcolor: '#FFFFFF',
          boxShadow: `0 16px 40px ${oracleRgba(0.1)}, 0 8px 24px rgba(30, 136, 229, 0.08)`,
          overflow: 'hidden',
          maxWidth: { xs: 'calc(100% - 24px)', sm: 640 },
        },
      }}
    >
      <DialogTitle sx={{ p: 0 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 2,
            px: 2.5,
            pt: 2.5,
            pb: 2,
            borderBottom: `1px solid ${oracleRgba(0.12)}`,
            backgroundColor: '#FFFFFF',
          }}
        >
          <Box sx={{ display: 'flex', gap: 1.75, minWidth: 0 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                bgcolor: oracleRgba(0.12),
                border: `1px solid ${oracleRgba(0.2)}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <EditIcon sx={{ color: ORACLE_RED_ACTION, fontSize: 26 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                sx={{
                  fontWeight: 800,
                  color: '#1A1A1A',
                  lineHeight: 1.25,
                  fontSize: '1.3rem',
                  letterSpacing: '-0.02em',
                }}
              >
                Edit sprint{sprint?.id != null ? ` #${sprint.id}` : ''}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: '#616161', fontWeight: 600, display: 'block', mt: 0.35 }}
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
            sx={{ color: '#616161', '&:hover': { bgcolor: oracleRgba(0.08) } }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent
        sx={{
          px: 2.5,
          pt: 2.25,
          pb: 1.5,
          backgroundColor: '#FFFFFF',
        }}
      >
        <Typography
          variant="body2"
          sx={{ color: '#424242', fontWeight: 600, lineHeight: 1.5, mb: 2 }}
        >
          Update the sprint window and optional goal. KPI metrics stored in the database are kept
          as-is.
        </Typography>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Start date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              size="small"
              sx={newSprintDialogFieldOutline()}
            />
            <TextField
              label="End date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              size="small"
              sx={newSprintDialogFieldOutline()}
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
              ...newSprintDialogFieldOutline(),
              '& .MuiOutlinedInput-root': { alignItems: 'flex-start' },
            }}
          />
        </Stack>
        {error ? (
          <Typography
            variant="caption"
            sx={{ color: ORACLE_RED_ACTION, fontWeight: 600, mt: 1.5, display: 'block' }}
          >
            {error}
          </Typography>
        ) : null}
      </DialogContent>

      <DialogActions
        sx={{
          px: 2.5,
          py: 2,
          gap: 1,
          borderTop: `1px solid ${oracleRgba(0.12)}`,
          backgroundColor: '#FFFFFF',
          justifyContent: 'flex-end',
        }}
      >
        <Button
          onClick={handleClose}
          disabled={saving}
          sx={{ color: '#616161', textTransform: 'none', fontWeight: 600, px: 2 }}
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
            '&.Mui-disabled': { bgcolor: '#E0E0E0', color: '#9E9E9E' },
          }}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
