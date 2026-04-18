import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Stack, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, IconButton,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import { API_BASE, ORACLE_RED_ACTION } from './constants/sprintConstants';
import { newSprintDialogFieldOutline, oracleRgba } from './utils/sprintUtils';

export function NewSprintDialog({ open, onClose, onCreated, projectId }) {
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [goal, setGoal] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const resolvedProjectId =
    projectId == null || projectId === ''
      ? NaN
      : Number(projectId);
  const hasValidProject = Number.isFinite(resolvedProjectId) && resolvedProjectId > 0;

  useEffect(() => {
    if (!open) return;
    setStartDate('');
    setDueDate('');
    setGoal('');
    setSaveError('');
  }, [open]);

  const handleClose = () => { if (!saving) onClose(); };
  const handleSave = async () => {
    if (!hasValidProject || !startDate || !dueDate) return;
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch(`${API_BASE}/api/sprints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedProject: { id: resolvedProjectId }, startDate: new Date(startDate).toISOString(), dueDate: new Date(dueDate).toISOString(), completionRate: 0, onTimeDelivery: 0, teamParticipation: 0, workloadBalance: 0, goal: goal.trim() || null }),
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
      setSaveError(e?.message || 'Could not reach the server. Is the backend running on port 8080?');
    } finally {
      setSaving(false);
    }
  };
  const canSave = Boolean(hasValidProject && startDate && dueDate);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth PaperProps={{ elevation: 0, sx: { borderRadius: 3, border: '1px solid #ECECEC', borderLeft: `4px solid ${ORACLE_RED_ACTION}`, bgcolor: '#FFFFFF', boxShadow: `0 16px 40px ${oracleRgba(0.1)}`, overflow: 'hidden', maxWidth: { xs: 'calc(100% - 24px)', sm: 640 } } }}>
      <DialogTitle sx={{ p: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, px: 2.5, pt: 2.5, pb: 2, borderBottom: `1px solid ${oracleRgba(0.12)}`, backgroundColor: '#FFFFFF' }}>
          <Box sx={{ display: 'flex', gap: 1.75 }}><Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: oracleRgba(0.12), border: `1px solid ${oracleRgba(0.2)}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AddIcon sx={{ color: ORACLE_RED_ACTION, fontSize: 26 }} /></Box><Box><Typography sx={{ fontWeight: 800, color: '#1A1A1A', fontSize: '1.3rem' }}>New sprint</Typography><Typography variant="caption" sx={{ color: '#616161', fontWeight: 600, display: 'block' }}>Schedule & goal</Typography></Box></Box>
          <IconButton onClick={handleClose} disabled={saving} size="small"><CloseIcon /></IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ px: 2.5, pt: 2.25, pb: 1.5, backgroundColor: '#FFFFFF' }}>
        <Typography variant="body2" sx={{ color: '#424242', fontWeight: 600, mb: 2 }}>Pick start and end dates, then add an optional sprint goal.</Typography>
        {!hasValidProject && (
          <Typography variant="caption" sx={{ color: ORACLE_RED_ACTION, fontWeight: 600, display: 'block', mb: 1 }}>
            No active project is selected. Select a project in the app or sign in again.
          </Typography>
        )}
        {saveError && (
          <Typography variant="caption" sx={{ color: ORACLE_RED_ACTION, fontWeight: 600, display: 'block', mb: 1, whiteSpace: 'pre-wrap' }}>
            {saveError}
          </Typography>
        )}
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Start date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth size="small" sx={newSprintDialogFieldOutline()} />
            <TextField label="End date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth size="small" sx={newSprintDialogFieldOutline()} />
          </Stack>
          <TextField label="Sprint goal (optional)" placeholder="What should this sprint achieve?" value={goal} onChange={(e) => setGoal(e.target.value)} fullWidth multiline minRows={4} inputProps={{ maxLength: 2000 }} helperText={`${goal.length} / 2000 characters`} sx={newSprintDialogFieldOutline()} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 2, gap: 1, borderTop: `1px solid ${oracleRgba(0.12)}` }}>
        <Button onClick={handleClose} disabled={saving} sx={{ color: '#616161', textTransform: 'none', fontWeight: 600 }}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving || !canSave} variant="contained" disableElevation sx={{ bgcolor: ORACLE_RED_ACTION, textTransform: 'none', fontWeight: 700, borderRadius: 2, '&:hover': { bgcolor: '#A83B2D' } }}>{saving ? 'Creating…' : 'Create sprint'}</Button>
      </DialogActions>
    </Dialog>
  );
}
