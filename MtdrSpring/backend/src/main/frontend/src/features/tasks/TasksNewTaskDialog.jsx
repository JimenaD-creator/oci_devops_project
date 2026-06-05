import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  IconButton,
  Alert,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import { developerNumericId } from '../../utils/userIds';
import { API_BASE, ORACLE_RED } from './constants/taskConstants';
import {
  FORM_FIELD_TINT_BG,
  ORACLE_RED_ACTION,
  STATUS_CHIP_SX,
  TASK_STATUS_LABEL,
} from '../sprints/constants/sprintConstants';
import {
  createTaskFormFieldSx,
  createTaskDeveloperSelectFieldSx,
  createTaskDeveloperSelectMenuProps,
  createTaskDeveloperSelectValueSx,
  createTaskSelectFillSx,
  createTaskSelectMenuProps,
  createTaskSelectPlaceholderSx,
  dateInputToEndOfLocalDayIso,
  dateInputToStartOfLocalDayIso,
  isDateInputOnOrBefore,
  pageFormFieldOutline,
} from './utils/taskUtils';
import { buildSprintNumberMap, formatSprintLabel } from '../sprints/utils/sprintUtils';

export function TasksNewTaskDialog({
  open,
  onClose,
  onCreated,
  sprints,
  projectDevelopers,
  defaultSprintId,
  pickerProjectId,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [classification, setClassification] = useState('FEATURE');
  const [status, setStatus] = useState('TODO');
  const [priority, setPriority] = useState('MEDIUM');
  const [assignedHours, setAssignedHours] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assignedUserId, setAssignedUserId] = useState('');
  const [sprintId, setSprintId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  /** null = not loaded for this open session; avoids empty list while parent list is still loading. */
  const [fetchedDevelopers, setFetchedDevelopers] = useState(null);
  const [developersLoading, setDevelopersLoading] = useState(false);

  const sprintNumberMap = useMemo(() => buildSprintNumberMap(sprints), [sprints]);

  // Obtener sprints ordenados para el select
  const sortedSprints = useMemo(() => {
    return [...(sprints || [])].sort((a, b) => a.id - b.id);
  }, [sprints]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setClassification('FEATURE');
    setStatus('TODO');
    setPriority('MEDIUM');
    setAssignedHours('');
    setStartDate('');
    setDueDate('');
    setAssignedUserId('');
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
    const pid =
      pickerProjectId != null && Number.isFinite(Number(pickerProjectId))
        ? Number(pickerProjectId)
        : null;
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
      const displayName =
        u?.name ?? u?.NAME ?? u?.email ?? u?.phoneNumber ?? `Developer ${index + 1}`;
      return { ...u, uid, displayName };
    });
  }, [availableDevelopers]);

  const validAvailableDevelopers = useMemo(() => {
    return normalizedAvailableDevelopers.filter((u) => u.uid != null && Number.isFinite(u.uid));
  }, [normalizedAvailableDevelopers]);

  useEffect(() => {
    const allowed = new Set(validAvailableDevelopers.map((u) => u.uid));
    setAssignedUserId((prev) => {
      const id = Number(prev);
      if (!Number.isFinite(id) || allowed.has(id)) return prev;
      return '';
    });
  }, [validAvailableDevelopers]);

  const handleSave = async () => {
    const hasSprintPick = sprintId !== '' && sprintId != null;
    if (
      !title.trim() ||
      !description.trim() ||
      !classification ||
      !status ||
      !priority ||
      !startDate ||
      !dueDate ||
      !hasSprintPick ||
      assignedUserId !== '' &&
      Number.isFinite(Number(assignedUserId))
    ) {
      setError('Please fill in all required fields (including a developer).');
      return;
    }
    if (!isDateInputOnOrBefore(startDate, dueDate)) {
      setError('Start date must be on or before due date.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const userId = Number(assignedUserId);
      const assigneeUserIds = Number.isFinite(userId) && userId > 0 ? [userId] : [];
      const dueIso = dateInputToEndOfLocalDayIso(dueDate);
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
          startDate: dateInputToStartOfLocalDayIso(startDate),
          dueDate: dueIso,
          finishDate: dueIso,
          assignedSprint: { id: Number(sprintId) },
          assigneeUserIds,
        }),
      });

      if (res.ok) {
        const createdTask = await res.json();
        onCreated(createdTask, assigneeUserIds, status, null);
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
    title.trim() &&
    description.trim() &&
    classification &&
    status &&
    priority &&
    startDate &&
    dueDate &&
    sprintId &&
    assignedUserId !== '' &&
    Number.isFinite(Number(assignedUserId)),
  );

  const fieldOutlineTint = useMemo(() => {
    const b = pageFormFieldOutline(isDark);
    return {
      ...b,
      '& .MuiOutlinedInput-root': {
        ...b['& .MuiOutlinedInput-root'],
        bgcolor: isDark ? 'rgba(255,255,255,0.03)' : FORM_FIELD_TINT_BG,
      },
    };
  }, [isDark]);

  const primaryFieldSx = useMemo(
    () =>
      createTaskFormFieldSx(isDark, {
        fieldTintBg: isDark ? 'rgba(255,255,255,0.03)' : FORM_FIELD_TINT_BG,
      }),
    [isDark],
  );

  const developerFieldSx = useMemo(
    () =>
      createTaskDeveloperSelectFieldSx(isDark, {
        fieldTintBg: isDark ? 'rgba(255,255,255,0.03)' : FORM_FIELD_TINT_BG,
      }),
    [isDark],
  );

  const compactSelectFieldSx = useMemo(() => createTaskSelectFillSx(isDark), [isDark]);

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
          border: '1px solid',
          borderColor: isDark ? '#2A2C32' : '#ECECEC',
          borderLeft: `4px solid ${ORACLE_RED}`,
          bgcolor: 'background.paper',
          boxShadow: isDark ? '0 16px 40px rgba(0,0,0,0.4)' : '0 16px 40px rgba(199, 70, 52, 0.12)',
          height: { xs: 'auto', sm: '88vh' },
          maxHeight: 'calc(100vh - 24px)',
          overflow: 'hidden',
          maxWidth: { xs: 'calc(100% - 32px)', sm: 980 },
        },
      }}
    >
      <DialogTitle sx={{ p: 0 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 1.5,
            px: 2.5,
            py: 2,
            borderBottom: '1px solid',
            borderBottomColor: isDark ? 'rgba(199, 70, 52, 0.2)' : 'rgba(199, 70, 52, 0.12)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                bgcolor: isDark ? 'rgba(199,70,52,0.15)' : 'rgba(199,70,52,0.10)',
                border: '1px solid',
                borderColor: isDark ? 'rgba(199, 70, 52, 0.25)' : 'rgba(199, 70, 52, 0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TaskAltIcon sx={{ color: ORACLE_RED }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', color: 'text.primary' }}>
                Create task
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', fontWeight: 600, display: 'block' }}
              >
                Details, planning & assignees
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={handleClose} size="small" disabled={saving}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent
        sx={{
          pt: 3.5,
          px: { xs: 3.5, sm: 5 },
          pb: 3.25,
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
        }}
      >
        <Stack spacing={2.25} sx={{ mx: { xs: 0.75, sm: 1.25 }, my: { xs: 0.5, sm: 0.75 } }}>
          <TextField
            label="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            size="small"
            sx={primaryFieldSx}
          />
          <TextField
            label="Task description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            minRows={5}
            size="small"
            sx={primaryFieldSx}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControl size="small" fullWidth sx={compactSelectFieldSx}>
              <InputLabel>Work item type</InputLabel>
              <Select
                value={classification}
                onChange={(e) => setClassification(e.target.value)}
                label="Work item type"
                MenuProps={createTaskSelectMenuProps}
              >
                <MenuItem value="FEATURE">Feature</MenuItem>
                <MenuItem value="BUG">Bug</MenuItem>
                <MenuItem value="TASK">Task</MenuItem>
                <MenuItem value="USER_STORY">User Story</MenuItem>
              </Select>
            </FormControl>
            <FormControl
              size="small"
              fullWidth
              sx={{
                ...fieldOutlineTint,
                '& .MuiSelect-select': { display: 'flex', alignItems: 'center' },
              }}
            >
              <InputLabel>Status</InputLabel>
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                label="Status"
                renderValue={(val) => {
                  const key = String(val || 'TODO').toUpperCase();
                  const chipKey = STATUS_CHIP_SX[key] ? key : 'TODO';
                  return (
                    <Chip
                      size="small"
                      label={TASK_STATUS_LABEL[chipKey] ?? key}
                      sx={{ fontWeight: 700, ...STATUS_CHIP_SX[chipKey] }}
                    />
                  );
                }}
              >
                <MenuItem value="TODO" sx={{ fontWeight: 700, color: STATUS_CHIP_SX.TODO.color }}>
                  To Do
                </MenuItem>
                <MenuItem value="IN_PROGRESS" sx={{ fontWeight: 600, color: '#1565C0' }}>
                  In Progress
                </MenuItem>
                <MenuItem value="IN_REVIEW" sx={{ fontWeight: 600, color: '#6A1B9A' }}>
                  In Review
                </MenuItem>
                <MenuItem value="DONE" sx={{ fontWeight: 600, color: '#2E7D32' }}>
                  Done
                </MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth sx={compactSelectFieldSx}>
              <InputLabel>Priority</InputLabel>
              <Select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                label="Priority"
                MenuProps={createTaskSelectMenuProps}
              >
                <MenuItem value="LOW">Low</MenuItem>
                <MenuItem value="MEDIUM">Medium</MenuItem>
                <MenuItem value="HIGH">High</MenuItem>
                <MenuItem value="CRITICAL">Critical</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControl size="small" fullWidth sx={compactSelectFieldSx}>
              <InputLabel>Sprint</InputLabel>
              <Select
                value={sprintId}
                onChange={(e) => setSprintId(e.target.value)}
                label="Sprint"
                renderValue={(value) => {
                  if (!value) return 'Select sprint';
                  return formatSprintLabel(sprintNumberMap, value);
                }}
              >
                {sortedSprints.map((s) => (
                  <MenuItem
                    key={s.id}
                    value={String(s.id)}
                    sx={{ fontWeight: 600, color: ORACLE_RED_ACTION }}
                  >
                    {formatSprintLabel(sprintNumberMap, s.id)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Assigned hours"
              type="number"
              value={assignedHours}
              onChange={(e) => setAssignedHours(e.target.value)}
              fullWidth
              size="small"
              inputProps={{ min: 0 }}
              sx={fieldOutlineTint}
            />
          </Stack>
          {pickerProjectId == null || !Number.isFinite(Number(pickerProjectId)) ? (
            <Alert severity="warning" sx={{ borderRadius: 2 }}>
              No se pudo determinar el proyecto activo. Vuelve a elegir un proyecto en la app
              (Change project) y abre de nuevo esta ventana.
            </Alert>
          ) : null}
          {developersLoading ? (
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              Cargando equipo del proyecto…
            </Typography>
          ) : null}
          {!developersLoading &&
          pickerProjectId != null &&
          Number.isFinite(Number(pickerProjectId)) &&
          validAvailableDevelopers.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              No hay desarrolladores asignables en este proyecto (equipo vacío o solo managers).
              Revisa el equipo en base de datos o el endpoint{' '}
              <Typography
                component="span"
                variant="caption"
                sx={{ fontWeight: 700 }}
              >{`/api/projects/${pickerProjectId}/developers`}</Typography>
              .
            </Alert>
          ) : null}
          <FormControl fullWidth size="small" sx={developerFieldSx}>
            <InputLabel id="create-task-assigned-label">Developer</InputLabel>
            <Select
              labelId="create-task-assigned-label"
              value={assignedUserId}
              onChange={(e) => setAssignedUserId(e.target.value)}
              label="Developer"
              renderValue={(value) => {
                if (!value) {
                  return (
                    <Typography component="span" sx={createTaskSelectPlaceholderSx}>
                      Select developer
                    </Typography>
                  );
                }
                const u = normalizedAvailableDevelopers.find((x) => x.uid === Number(value));
                return (
                  <Typography component="span" sx={createTaskDeveloperSelectValueSx}>
                    {u?.displayName ?? `#${value}`}
                  </Typography>
                );
              }}
              MenuProps={createTaskDeveloperSelectMenuProps}
            >
              {validAvailableDevelopers.map((u) => (
                <MenuItem key={u.uid} value={u.uid}>
                  {u.displayName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              size="small"
              sx={fieldOutlineTint}
            />
            <TextField
              label="Due Date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              size="small"
              sx={fieldOutlineTint}
            />
          </Stack>
          {error && (
            <Typography variant="caption" sx={{ color: '#C62828', fontWeight: 600 }}>
              {error}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions
        sx={{
          px: 2.5,
          pb: 2.25,
          pt: 1.5,
          borderTop: '1px solid',
          borderTopColor: isDark ? 'rgba(199, 70, 52, 0.2)' : 'rgba(199, 70, 52, 0.12)',
        }}
      >
        <Button
          onClick={handleClose}
          sx={{ color: 'text.secondary', textTransform: 'none', fontWeight: 600 }}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || !canSave}
          variant="contained"
          sx={{
            bgcolor: ORACLE_RED,
            textTransform: 'none',
            fontWeight: 700,
            '&:hover': { bgcolor: '#A83B2D' },
          }}
        >
          {saving ? 'Creating...' : 'Create task'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
