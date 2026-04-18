import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Stack, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControl, InputLabel, Select, MenuItem,
  OutlinedInput, Checkbox, Button, IconButton, Chip, Alert,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import { developerAvatarColors } from '../../utils/developerColors';
import { developerNumericId, finiteUserIds, multiselectNumericIds } from '../../utils/userIds';
import { API_BASE, ORACLE_RED } from './constants/taskConstants';
import { createTaskSelectFillSx, pageFormFieldOutline } from './utils/taskUtils';

export function TasksNewTaskDialog({
  open,
  onClose,
  onCreated,
  sprints,
  projectDevelopers,
  defaultSprintId,
  pickerProjectId,
}) {
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
  /** null = not loaded for this open session; avoids empty list while parent list is still loading. */
  const [fetchedDevelopers, setFetchedDevelopers] = useState(null);
  const [developersLoading, setDevelopersLoading] = useState(false);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setClassification('FEATURE');
    setStatus('TODO');
    setPriority('MEDIUM');
    setAssignedHours('');
    setStartDate('');
    setDueDate('');
    setAssignedToIds([]);
    setSprintId('');
    setError('');
    setFetchedDevelopers(null);
  };

  useEffect(() => {
    if (!open) return;
    const fallbackSprintId = defaultSprintId != null ? String(defaultSprintId) : '';
    const isValidDefault = sprints.some((s) => String(s.id) === fallbackSprintId);
    setSprintId(isValidDefault ? fallbackSprintId : '');
  }, [open, defaultSprintId, sprints]);

  const handleClose = () => {
    if (!saving) {
      resetForm();
      onClose();
    }
  };

  useEffect(() => {
    if (!open) {
      setFetchedDevelopers(null);
      setDevelopersLoading(false);
      return;
    }
    const pid = pickerProjectId != null && Number.isFinite(Number(pickerProjectId)) ? Number(pickerProjectId) : null;
    if (pid == null) {
      setFetchedDevelopers([]);
      setDevelopersLoading(false);
      return;
    }
    let cancelled = false;
    setDevelopersLoading(true);
    (async () => {
      try {
        const url = `${API_BASE}/api/projects/${pid}/developers`;
        const res = await fetch(url, {
          headers: { Accept: 'application/json' },
        });
        const data = res.ok ? await res.json() : [];
        if (!cancelled) {
          setFetchedDevelopers(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!cancelled) setFetchedDevelopers([]);
      } finally {
        if (!cancelled) setDevelopersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, pickerProjectId]);

  const availableDevelopers = useMemo(() => {
    if (Array.isArray(fetchedDevelopers) && fetchedDevelopers.length > 0) return fetchedDevelopers;
    return Array.isArray(projectDevelopers) ? projectDevelopers : [];
  }, [fetchedDevelopers, projectDevelopers]);

  const normalizedAvailableDevelopers = useMemo(() => {
    return (availableDevelopers || []).map((u, index) => {
      const uid = developerNumericId(u);
      const displayName = u?.name ?? u?.NAME ?? u?.email ?? u?.phoneNumber ?? `Developer ${index + 1}`;
      return { ...u, uid, displayName };
    });
  }, [availableDevelopers]);

  const validAvailableDevelopers = useMemo(() => {
    return normalizedAvailableDevelopers.filter((u) => u.uid != null && Number.isFinite(u.uid));
  }, [normalizedAvailableDevelopers]);

  useEffect(() => {
    setAssignedToIds((prev) => {
      const allowed = new Set(validAvailableDevelopers.map((u) => u.uid));
      return finiteUserIds(prev).filter((id) => allowed.has(id));
    });
  }, [validAvailableDevelopers]);

  const handleSave = async () => {
    const hasSprintPick = sprintId !== '' && sprintId != null;
    if (
      !title.trim()
      || !description.trim()
      || !classification
      || !status
      || !priority
      || !startDate
      || !dueDate
      || !hasSprintPick
      || assignedToIds.length === 0
    ) {
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
        }),
      });

      if (res.ok) {
        const createdTask = await res.json();

        const assignmentPromises = assignedToIds.map(async (uid) => {
          const assignRes = await fetch(`${API_BASE}/api/user-tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: Number(uid),
              taskId: createdTask.id,
              status,
              workedHours: 0,
            }),
          });
          if (!assignRes.ok) {
            const errorText = await assignRes.text();
            throw new Error(`Assignment failed for user ${uid}: ${errorText}`);
          }
          return assignRes.json();
        });

        await Promise.all(assignmentPromises);

        onCreated(createdTask, assignedToIds, status, null);
        handleClose();
      } else {
        const errorText = await res.text();
        setError(`Could not create task: ${errorText}`);
      }
    } catch (err) {
      setError(`Connection error: ${err.message ?? err}`);
    } finally {
      setSaving(false);
    }
  };

  const canSave = Boolean(
    title.trim()
    && description.trim()
    && classification
    && status
    && priority
    && startDate
    && dueDate
    && sprintId
    && finiteUserIds(assignedToIds).length > 0,
  );

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        elevation: 0,
        sx: {
          borderRadius: 3,
          border: '1px solid #ECECEC',
          borderLeft: `4px solid ${ORACLE_RED}`,
          bgcolor: '#FFFFFF',
          boxShadow: '0 16px 40px rgba(199, 70, 52, 0.12)',
          height: { xs: 'auto', sm: '88vh' },
          maxHeight: 'calc(100vh - 24px)',
          overflow: 'hidden',
          maxWidth: { xs: 'calc(100% - 32px)', sm: 980 },
        },
      }}
    >
      <DialogTitle sx={{ p: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, px: 2.5, py: 2, borderBottom: '1px solid rgba(199, 70, 52, 0.12)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: 'rgba(199,70,52,0.10)', border: '1px solid rgba(199, 70, 52, 0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TaskAltIcon sx={{ color: ORACLE_RED }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', color: '#1A1A1A' }}>Create task</Typography>
              <Typography variant="caption" sx={{ color: '#616161', fontWeight: 600, display: 'block' }}>Details, planning & assignees</Typography>
            </Box>
          </Box>
          <IconButton onClick={handleClose} size="small" disabled={saving}><CloseIcon /></IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ pt: 3.5, px: { xs: 3.5, sm: 5 }, pb: 3.25, flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <Stack spacing={2.25} sx={{ mx: { xs: 0.75, sm: 1.25 }, my: { xs: 0.5, sm: 0.75 } }}>
          <TextField label="Task title" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth multiline minRows={2} sx={{ ...pageFormFieldOutline(), '& .MuiOutlinedInput-root': { bgcolor: 'rgba(199, 70, 52, 0.07)' } }} />
          <TextField label="Task description" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth multiline minRows={5} sx={pageFormFieldOutline()} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControl size="small" fullWidth sx={createTaskSelectFillSx()}>
              <InputLabel>Work item type</InputLabel>
              <Select value={classification} onChange={(e) => setClassification(e.target.value)} label="Work item type">
                <MenuItem value="FEATURE">Feature</MenuItem>
                <MenuItem value="BUG">Bug</MenuItem>
                <MenuItem value="TASK">Task</MenuItem>
                <MenuItem value="USER_STORY">User Story</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth sx={pageFormFieldOutline()}>
              <InputLabel>Status</InputLabel>
              <Select value={status} onChange={(e) => setStatus(e.target.value)} label="Status">
                <MenuItem value="TODO">To Do</MenuItem>
                <MenuItem value="IN_PROGRESS">In Progress</MenuItem>
                <MenuItem value="IN_REVIEW">In Review</MenuItem>
                <MenuItem value="DONE">Done</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth sx={createTaskSelectFillSx()}>
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
            <FormControl size="small" fullWidth sx={createTaskSelectFillSx()}>
              <InputLabel>Sprint</InputLabel>
              <Select value={sprintId} onChange={(e) => setSprintId(e.target.value)} label="Sprint">
                {sprints.map((s) => (<MenuItem key={s.id} value={String(s.id)}>{`Sprint ${s.id}`}</MenuItem>))}
              </Select>
            </FormControl>
            <TextField label="Assigned hours" type="number" value={assignedHours} onChange={(e) => setAssignedHours(e.target.value)} fullWidth size="small" inputProps={{ min: 0 }} sx={pageFormFieldOutline()} />
          </Stack>
          {pickerProjectId == null || !Number.isFinite(Number(pickerProjectId)) ? (
            <Alert severity="warning" sx={{ borderRadius: 2 }}>
              No se pudo determinar el proyecto activo. Vuelve a elegir un proyecto en la app (Change project) y abre de nuevo esta ventana.
            </Alert>
          ) : null}
          {developersLoading ? (
            <Typography variant="caption" sx={{ color: '#616161', fontWeight: 600 }}>
              Cargando equipo del proyecto…
            </Typography>
          ) : null}
          {!developersLoading && pickerProjectId != null && Number.isFinite(Number(pickerProjectId)) && validAvailableDevelopers.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              No hay desarrolladores asignables en este proyecto (equipo vacío o solo managers). Revisa el equipo en base de datos o el endpoint{' '}
              <Typography component="span" variant="caption" sx={{ fontWeight: 700 }}>{`/api/projects/${pickerProjectId}/developers`}</Typography>.
            </Alert>
          ) : null}
          <FormControl fullWidth size="small" sx={pageFormFieldOutline()}>
            <InputLabel id="create-task-assigned-label">Developers</InputLabel>
            <Select
              labelId="create-task-assigned-label"
              multiple
              value={finiteUserIds(assignedToIds)}
              onChange={(e) => setAssignedToIds(multiselectNumericIds(e.target.value))}
              input={<OutlinedInput label="Developers" />}
              renderValue={(selected) => (
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
                  {finiteUserIds(selected).map((id) => {
                    const u = normalizedAvailableDevelopers.find((x) => x.uid === id);
                    const name = u?.displayName ?? `#${id}`;
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
                  })}
                </Box>
              )}
              MenuProps={{ PaperProps: { style: { maxHeight: 280 } } }}
            >
              {validAvailableDevelopers.map((u) => {
                const uid = u.uid;
                const selectedIds = finiteUserIds(assignedToIds);
                return (
                  <MenuItem key={uid} value={uid}>
                    <Checkbox checked={selectedIds.includes(uid)} size="small" sx={{ py: 0 }} />
                    <Typography variant="body2" sx={{ color: '#1A1A1A' }}>
                      {u.displayName}
                    </Typography>
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth size="small" sx={pageFormFieldOutline()} />
            <TextField label="Due Date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth size="small" sx={pageFormFieldOutline()} />
          </Stack>
          {error && <Typography variant="caption" sx={{ color: '#C62828', fontWeight: 600 }}>{error}</Typography>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2.25, pt: 1.5, borderTop: '1px solid rgba(199, 70, 52, 0.12)' }}>
        <Button onClick={handleClose} sx={{ color: '#616161', textTransform: 'none', fontWeight: 600 }} disabled={saving}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving || !canSave} variant="contained" sx={{ bgcolor: ORACLE_RED, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: '#A83B2D' } }}>{saving ? 'Creating...' : 'Create task'}</Button>
      </DialogActions>
    </Dialog>
  );
}
