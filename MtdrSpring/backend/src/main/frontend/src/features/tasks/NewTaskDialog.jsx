import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Stack, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControl, InputLabel, Select, MenuItem,
  OutlinedInput, Checkbox, ListItemText, Chip,
  Button, IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import { developerAvatarColors } from '../../utils/developerColors';
import { developerNumericId, finiteUserIds, multiselectNumericIds } from '../../utils/userIds';
import { API_BASE, ORACLE_RED_ACTION } from '../sprints/constants/sprintConstants';
import { newSprintDialogFieldOutline, oracleRgba } from '../sprints/utils/sprintUtils';

export function NewTaskDialog({ open, onClose, onCreated, sprints, projectDevelopers, defaultSprintId }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [classification, setClassification] = useState('FEATURE');
  const [status, setStatus] = useState('TODO');
  const [priority, setPriority] = useState('MEDIUM');
  const [assignedHours, setAssignedHours] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assignedToIds, setAssignedToIds] = useState([]);
  const [sprintId, setSprintId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const fallbackSprintId = defaultSprintId != null ? String(defaultSprintId) : '';
    const isValidDefault = (sprints || []).some((s) => String(s.id) === fallbackSprintId);
    setSprintId(isValidDefault ? fallbackSprintId : '');
    setTitle('');
    setDescription('');
    setClassification('FEATURE');
    setStatus('TODO');
    setPriority('MEDIUM');
    setAssignedHours('');
    setStartDate('');
    setDueDate('');
    setAssignedToIds([]);
    setError('');
  }, [open, defaultSprintId, sprints]);

  const validDevelopers = useMemo(
    () =>
      (projectDevelopers || [])
        .map((u, idx) => ({
          uid: developerNumericId(u),
          displayName: u?.name ?? u?.NAME ?? u?.email ?? `Developer ${idx + 1}`,
        }))
        .filter((u) => u.uid != null && Number.isFinite(u.uid)),
    [projectDevelopers],
  );

  const canSave = Boolean(
    title.trim()
    && description.trim()
    && startDate
    && dueDate
    && sprintId
    && assignedToIds.length > 0,
  );

  const handleClose = () => {
    if (!saving) onClose();
  };

  const handleSave = async () => {
    if (!canSave) {
      setError('Please fill in all required fields (including at least one developer).');
      return;
    }
    if (new Date(startDate) > new Date(dueDate)) {
      setError('Start date must be on or before due date.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const userIds = finiteUserIds(assignedToIds);
      const res = await fetch(`${API_BASE}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          classification,
          status,
          priority,
          assignedHours: assignedHours ? Number(assignedHours) : null,
          startDate: new Date(startDate).toISOString(),
          dueDate: new Date(dueDate).toISOString(),
          finishDate: new Date(dueDate).toISOString(),
          assignedSprint: { id: Number(sprintId) },
          assigneeUserIds: userIds,
        }),
      });
      if (!res.ok) {
        setError(`Could not create task (${res.status}).`);
        return;
      }
      const task = await res.json();
      onCreated?.(task, userIds, status);
      onClose();
    } catch {
      setError('Connection error.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth PaperProps={{ elevation: 0, sx: { borderRadius: 3, border: '1px solid #ECECEC', borderLeft: `4px solid ${ORACLE_RED_ACTION}`, bgcolor: '#FFFFFF', boxShadow: `0 16px 40px ${oracleRgba(0.1)}`, overflow: 'hidden', maxWidth: { xs: 'calc(100% - 24px)', sm: 760 } } }}>
      <DialogTitle sx={{ p: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, px: 2.5, pt: 2.5, pb: 2, borderBottom: `1px solid ${oracleRgba(0.12)}`, backgroundColor: '#FFFFFF' }}>
          <Box sx={{ display: 'flex', gap: 1.75 }}>
            <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: oracleRgba(0.12), border: `1px solid ${oracleRgba(0.2)}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TaskAltIcon sx={{ color: ORACLE_RED_ACTION, fontSize: 26 }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, color: '#1A1A1A', fontSize: '1.3rem' }}>Create task</Typography>
              <Typography variant="caption" sx={{ color: '#616161', fontWeight: 600, display: 'block' }}>Details, planning & assignees</Typography>
            </Box>
          </Box>
          <IconButton onClick={handleClose} disabled={saving} size="small"><CloseIcon /></IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ pt: 3.5, px: { xs: 3.5, sm: 4.5 }, pb: 3, overflowY: 'auto' }}>
        <Stack spacing={2.25} sx={{ mx: { xs: 0.5, sm: 0.75 }, my: { xs: 0.5, sm: 0.75 } }}>
          <TextField
            label="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            sx={{ ...newSprintDialogFieldOutline(), mt: 0.5 }}
          />
          <TextField label="Task description" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth multiline minRows={4} sx={newSprintDialogFieldOutline()} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControl size="small" fullWidth sx={newSprintDialogFieldOutline()}>
              <InputLabel>Work item type</InputLabel>
              <Select value={classification} onChange={(e) => setClassification(e.target.value)} label="Work item type">
                <MenuItem value="FEATURE">Feature</MenuItem>
                <MenuItem value="BUG">Bug</MenuItem>
                <MenuItem value="TASK">Task</MenuItem>
                <MenuItem value="USER_STORY">User Story</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth sx={newSprintDialogFieldOutline()}>
              <InputLabel>Status</InputLabel>
              <Select value={status} onChange={(e) => setStatus(e.target.value)} label="Status">
                <MenuItem value="TODO">To Do</MenuItem>
                <MenuItem value="IN_PROGRESS">In Progress</MenuItem>
                <MenuItem value="IN_REVIEW">In Review</MenuItem>
                <MenuItem value="DONE">Done</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth sx={newSprintDialogFieldOutline()}>
              <InputLabel>Priority</InputLabel>
              <Select value={priority} onChange={(e) => setPriority(e.target.value)} label="Priority">
                <MenuItem value="LOW">Low</MenuItem>
                <MenuItem value="MEDIUM">Medium</MenuItem>
                <MenuItem value="HIGH">High</MenuItem>
                <MenuItem value="CRITICAL">Critical</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControl size="small" fullWidth sx={newSprintDialogFieldOutline()}>
              <InputLabel>Sprint</InputLabel>
              <Select value={sprintId} onChange={(e) => setSprintId(e.target.value)} label="Sprint">
                {(sprints || []).map((s) => (<MenuItem key={s.id} value={String(s.id)}>{`Sprint ${s.id}`}</MenuItem>))}
              </Select>
            </FormControl>
            <TextField label="Assigned hours" type="number" value={assignedHours} onChange={(e) => setAssignedHours(e.target.value)} fullWidth size="small" inputProps={{ min: 0 }} sx={newSprintDialogFieldOutline()} />
          </Stack>
          <FormControl
            fullWidth
            size="small"
            sx={{
              ...newSprintDialogFieldOutline(),
              /* MUI Select multiple defaults to nowrap + ellipsis; chips need wrap + visible overflow */
              '& .MuiSelect-select': {
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                alignContent: 'center',
                gap: 0.5,
                minHeight: 40,
                whiteSpace: 'normal',
                overflow: 'visible',
                textOverflow: 'clip',
                py: 0.75,
              },
            }}
          >
            <InputLabel id="create-task-assigned-label">Developers</InputLabel>
            <Select
              labelId="create-task-assigned-label"
              multiple
              value={finiteUserIds(assignedToIds)}
              onChange={(e) => setAssignedToIds(multiselectNumericIds(e.target.value))}
              input={<OutlinedInput label="Developers" />}
              renderValue={(selected) => {
                const ids = finiteUserIds(selected);
                return (
                  <Box
                    sx={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 0.5,
                      maxHeight: 80,
                      overflowY: 'auto',
                      py: 0.25,
                      width: '100%',
                    }}
                  >
                    {ids.length === 0 ? (
                      <Typography component="span" variant="body2" sx={{ color: '#9E9E9E' }}>
                        Select developers
                      </Typography>
                    ) : (
                      ids.map((id) => {
                        const name = validDevelopers.find((u) => u.uid === id)?.displayName ?? `#${id}`;
                        const av = developerAvatarColors(name);
                        return (
                          <Chip
                            key={id}
                            size="small"
                            label={name}
                            variant="outlined"
                            sx={{
                              fontWeight: 600,
                              bgcolor: 'transparent',
                              color: av.color,
                              borderColor: av.color,
                              borderWidth: 1,
                            }}
                          />
                        );
                      })
                    )}
                  </Box>
                );
              }}
              MenuProps={{ PaperProps: { style: { maxHeight: 280 } } }}
            >
              {validDevelopers.map((u) => (
                <MenuItem key={u.uid} value={u.uid}>
                  <Checkbox checked={finiteUserIds(assignedToIds).includes(u.uid)} size="small" />
                  <ListItemText primary={u.displayName} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth size="small" sx={newSprintDialogFieldOutline()} />
            <TextField label="Due Date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth size="small" sx={newSprintDialogFieldOutline()} />
          </Stack>
          {error && <Typography variant="caption" sx={{ color: '#C62828', fontWeight: 600 }}>{error}</Typography>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 2, gap: 1, borderTop: `1px solid ${oracleRgba(0.12)}` }}>
        <Button onClick={handleClose} disabled={saving} sx={{ color: '#616161', textTransform: 'none', fontWeight: 600 }}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving || !canSave} variant="contained" disableElevation sx={{ bgcolor: ORACLE_RED_ACTION, textTransform: 'none', fontWeight: 700, borderRadius: 2, '&:hover': { bgcolor: '#A83B2D' } }}>{saving ? 'Creating…' : 'Create task'}</Button>
      </DialogActions>
    </Dialog>
  );
}
