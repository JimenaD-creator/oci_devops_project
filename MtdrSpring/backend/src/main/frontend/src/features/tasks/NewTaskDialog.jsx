import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Checkbox,
  ListItemText,
  Chip,
  Button,
  IconButton,
  Typography,
  Stack,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import { developerNumericId, finiteUserIds, multiselectNumericIds } from '../../utils/userIds';
import {
  API_BASE,
  FORM_FIELD_TINT_BG,
  ORACLE_RED_ACTION,
} from '../sprints/constants/sprintConstants';

const TYPE_OPTIONS = [
  {
    value: 'FEATURE',
    label: 'Feature',
    bg: '#EEEDFE',
    border: '#AFA9EC',
    color: '#3C3489',
    icon: '✦',
  },
  {
    value: 'BUG',
    label: 'Bug',
    bg: '#FCEBEB',
    border: '#F09595',
    color: '#791F1F',
    icon: '⬡',
  },
  {
    value: 'TASK',
    label: 'Task',
    bg: '#E6F1FB',
    border: '#85B7EB',
    color: '#0C447C',
    icon: '◻',
  },
  {
    value: 'USER_STORY',
    label: 'User Story',
    bg: '#EAF3DE',
    border: '#97C459',
    color: '#27500A',
    icon: '◈',
  },
];

const STATUS_OPTIONS = [
  {
    value: 'TODO',
    label: 'To Do',
    bg: '#E0F2F1',
    border: '#80CBC4',
    color: '#00695C',
    dot: '#00897B',
  },
  {
    value: 'IN_PROGRESS',
    label: 'In Progress',
    bg: '#FAEEDA',
    border: '#FAC775',
    color: '#633806',
    dot: '#BA7517',
  },
  {
    value: 'IN_REVIEW',
    label: 'In Review',
    bg: '#E6F1FB',
    border: '#85B7EB',
    color: '#0C447C',
    dot: '#185FA5',
  },
  {
    value: 'DONE',
    label: 'Done',
    bg: '#EAF3DE',
    border: '#97C459',
    color: '#27500A',
    dot: '#3B6D11',
  },
];

const PRIORITY_OPTIONS = [
  {
    value: 'LOW',
    label: 'Low',
    bg: '#EAF3DE',
    border: '#97C459',
    color: '#27500A',
  },
  {
    value: 'MEDIUM',
    label: 'Medium',
    bg: '#FAEEDA',
    border: '#FAC775',
    color: '#633806',
  },
  {
    value: 'HIGH',
    label: 'High',
    bg: '#FAECE7',
    border: '#F0997B',
    color: '#712B13',
  },
  {
    value: 'CRITICAL',
    label: 'Critical',
    bg: '#FCEBEB',
    border: '#F09595',
    color: '#791F1F',
  },
];

// ── Subcomponentes ────────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
      <Typography
        sx={{
          fontSize: 12,
          fontWeight: 600,
          color: 'text.secondary',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}
      >
        {children}
      </Typography>
      <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
    </Box>
  );
}

function SegmentedButtons({ options, value, onChange, sx }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Box sx={{ display: 'flex', gap: 0.75, ...sx }}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <Box
            key={opt.value}
            component="button"
            onClick={() => onChange(opt.value)}
            sx={{
              flex: 1,
              py: 0.875,
              px: 0.5,
              borderRadius: '8px',
              border: `1px solid ${active ? opt.border : (isDark ? '#2A2C32' : '#E0E0E0')}`,
              bgcolor: active ? opt.bg : 'transparent',
              color: active ? opt.color : (isDark ? '#9A9A9A' : 'text.secondary'),
              fontSize: 15,
              fontWeight: active ? 600 : 500,
              cursor: 'pointer',
              transition: 'all 0.12s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.5,
              '&:hover': {
                bgcolor: active ? opt.bg : (isDark ? '#2A2C32' : 'action.hover'),
                borderColor: opt.border,
              },
            }}
          >
            {opt.dot && (
              <Box
                sx={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  bgcolor: active ? opt.dot : (isDark ? '#5A5A5A' : '#BDBDBD'),
                  flexShrink: 0,
                }}
              />
            )}
            {opt.label}
          </Box>
        );
      })}
    </Box>
  );
}

function TypeGrid({ value, onChange }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 0.75,
      }}
    >
      {TYPE_OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <Box
            key={opt.value}
            component="button"
            onClick={() => onChange(opt.value)}
            sx={{
              py: 1,
              px: 0.5,
              borderRadius: '8px',
              border: `1px solid ${active ? opt.border : (isDark ? '#2A2C32' : '#E0E0E0')}`,
              bgcolor: active ? opt.bg : 'transparent',
              color: active ? opt.color : (isDark ? '#9A9A9A' : 'text.secondary'),
              fontSize: 15,
              fontWeight: active ? 600 : 500,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.5,
              transition: 'all 0.12s',
              '&:hover': {
                bgcolor: active ? opt.bg : (isDark ? '#2A2C32' : 'action.hover'),
                borderColor: opt.border,
              },
            }}
          >
            <Box sx={{ fontSize: 18, lineHeight: 1 }}>{opt.icon}</Box>
            {opt.label}
          </Box>
        );
      })}
    </Box>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function NewTaskDialog({
  open,
  onClose,
  onCreated,
  sprints,
  projectDevelopers,
  defaultSprintId,
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
  const [assignedToIds, setAssignedToIds] = useState([]);
  const [sprintId, setSprintId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Crear mapa de números de sprint secuenciales
  const sprintNumberMap = useMemo(() => {
    const map = new Map();
    [...(sprints || [])].sort((a, b) => a.id - b.id).forEach((s, i) => map.set(s.id, i + 1));
    return map;
  }, [sprints]);

  // Obtener sprints ordenados para el select
  const sortedSprints = useMemo(() => {
    return [...(sprints || [])].sort((a, b) => a.id - b.id);
  }, [sprints]);

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
    title.trim() &&
    description.trim() &&
    startDate &&
    dueDate &&
    sprintId &&
    assignedToIds.length > 0,
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

  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: '8px',
      fontSize: 15,
      bgcolor: isDark ? 'rgba(255,255,255,0.03)' : FORM_FIELD_TINT_BG,
      '& input, & textarea, & .MuiSelect-select': { fontSize: 15, bgcolor: 'transparent' },
      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#C74126' },
      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
        borderColor: '#C74126',
        boxShadow: '0 0 0 3px rgba(199,65,38,0.08)',
      },
    },
    '& .MuiInputLabel-root': { fontSize: 15, color: isDark ? '#9A9A9A' : undefined },
    '& .MuiInputLabel-root.Mui-focused': { color: '#C74126' },
    '& .MuiMenuItem-root': { fontSize: 15, color: isDark ? '#F0F0F0' : '#1A1A1A' },
  };

  const chipPalettes = isDark
    ? [
        { bg: '#2D2A4A', border: '#6A5ACD', color: '#B39DDB' },
        { bg: '#1A4A3A', border: '#4DB6AC', color: '#80CBC4' },
        { bg: '#4A2A1A', border: '#FFB74D', color: '#FFCC80' },
        { bg: '#4A1A1A', border: '#EF9A9A', color: '#FFAB91' },
      ]
    : [
        { bg: '#EEEDFE', border: '#AFA9EC', color: '#3C3489' },
        { bg: '#E1F5EE', border: '#5DCAA5', color: '#085041' },
        { bg: '#FAEEDA', border: '#FAC775', color: '#633806' },
        { bg: '#FAECE7', border: '#F0997B', color: '#712B13' },
      ];

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
          border: `1px solid ${isDark ? '#2A2C32' : '#ECECEC'}`,
          bgcolor: 'background.paper',
          overflow: 'hidden',
          maxWidth: { xs: 'calc(100% - 24px)', sm: 680 },
        },
      }}
    >
      {/* ── Header ── */}
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
              <AccountTreeOutlinedIcon sx={{ color: '#fff', fontSize: 20 }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 600, color: '#fff', fontSize: 16, lineHeight: 1.2 }}>
                Create task
              </Typography>
              <Typography sx={{ fontSize: 14, color: 'rgba(255,255,255,0.72)', display: 'block' }}>
                Details, planning & assignees
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

      {/* ── Body ── */}
      <DialogContent sx={{ pt: '32px !important', px: 3, pb: 2, overflowY: 'auto', bgcolor: isDark ? '#111214' : 'transparent' }}>
        <Stack spacing={2}>
          <TextField
            label="Task title *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            size="small"
            sx={fieldSx}
          />

          <TextField
            label="Description *"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            minRows={3}
            size="small"
            sx={fieldSx}
          />

          {/* Type*/}
          <Box>
            <SectionLabel>Work item type</SectionLabel>
            <TypeGrid value={classification} onChange={setClassification} />
          </Box>

          {/* Status */}
          <Box>
            <SectionLabel>Status</SectionLabel>
            <SegmentedButtons options={STATUS_OPTIONS} value={status} onChange={setStatus} />
          </Box>

          {/* Priority */}
          <Box>
            <SectionLabel>Priority</SectionLabel>
            <SegmentedButtons options={PRIORITY_OPTIONS} value={priority} onChange={setPriority} />
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <FormControl size="small" fullWidth sx={fieldSx}>
              <InputLabel>Sprint *</InputLabel>
              <Select
                value={sprintId}
                onChange={(e) => setSprintId(e.target.value)}
                label="Sprint *"
                renderValue={(value) => {
                  if (!value) return 'Select sprint';
                  const sprintNum = sprintNumberMap.get(Number(value));
                  return sprintNum ? `Sprint ${sprintNum}` : `Sprint ${value}`;
                }}
              >
                {sortedSprints.map((s) => {
                  const sprintNumber = sprintNumberMap.get(s.id);
                  return (
                    <MenuItem
                      key={s.id}
                      value={String(s.id)}
                      sx={{ fontWeight: 600, color: ORACLE_RED_ACTION }}
                    >
                      {sprintNumber ? `Sprint ${sprintNumber}` : `Sprint ${s.id}`}
                    </MenuItem>
                  );
                })}
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
              sx={fieldSx}
            />
          </Stack>

          {/* Developers */}
          <FormControl
            fullWidth
            size="small"
            sx={{
              ...fieldSx,
              '& .MuiSelect-select': {
                display: 'flex',
                flexWrap: 'wrap',
                gap: 0.5,
                minHeight: 40,
                whiteSpace: 'normal',
                overflow: 'visible',
                textOverflow: 'clip',
                py: 0.75,
              },
            }}
          >
            <InputLabel id="dev-label">Developers *</InputLabel>
            <Select
              labelId="dev-label"
              multiple
              value={finiteUserIds(assignedToIds)}
              onChange={(e) => setAssignedToIds(multiselectNumericIds(e.target.value))}
              input={<OutlinedInput label="Developers *" />}
              renderValue={(selected) => {
                const ids = finiteUserIds(selected);
                return (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, py: 0.25 }}>
                    {ids.length === 0 ? (
                      <Typography variant="body2" sx={{ color: 'text.disabled', fontSize: 15 }}>
                        Select developers
                      </Typography>
                    ) : (
                      ids.map((id, i) => {
                        const name =
                          validDevelopers.find((u) => u.uid === id)?.displayName ?? `#${id}`;
                        const pal = chipPalettes[i % chipPalettes.length];
                        return (
                          <Chip
                            key={id}
                            size="small"
                            label={name}
                            sx={{
                              fontWeight: 600,
                              fontSize: 14,
                              bgcolor: pal.bg,
                              color: pal.color,
                              border: `1px solid ${pal.border}`,
                              borderRadius: '20px',
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
                  <Checkbox
                    checked={finiteUserIds(assignedToIds).includes(u.uid)}
                    size="small"
                    sx={{ '&.Mui-checked': { color: ORACLE_RED_ACTION } }}
                  />
                  <ListItemText
                    primary={u.displayName}
                    primaryTypographyProps={{ fontSize: 15, fontWeight: 500, color: isDark ? '#F0F0F0' : '#1A1A1A' }}
                  />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Dates */}
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
              label="Due date *"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              size="small"
              sx={fieldSx}
            />
          </Stack>

          {error && (
            <Typography sx={{ fontSize: 13, color: '#C62828', fontWeight: 600 }}>
              {error}
            </Typography>
          )}
        </Stack>
      </DialogContent>

      {/* ── Footer ── */}
      <DialogActions
        sx={{
          px: 3,
          py: 1.5,
          gap: 1,
          borderTop: `1px solid ${isDark ? '#2A2C32' : '#F0F0F0'}`,
          bgcolor: isDark ? '#111214' : '#FAFAFA',
          justifyContent: 'space-between',
        }}
      >
        <Typography sx={{ fontSize: 13, color: 'text.disabled' }}>
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
              fontSize: 14,
              color: 'text.secondary',
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: '8px',
              border: `1px solid ${isDark ? '#2A2C32' : '#E0E0E0'}`,
              px: 2,
              '&:hover': { bgcolor: isDark ? '#2A2C32' : '#F5F5F5' },
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
            {saving ? 'Creating…' : 'Create task'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}