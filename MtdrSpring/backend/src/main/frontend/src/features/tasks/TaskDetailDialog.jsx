import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Stack,
  Paper,
  CircularProgress,
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
  Chip,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import {
  developerNumericId,
  finiteUserIds,
  normalizeUserId,
} from '../../utils/userIds';
import {
  ORACLE_RED,
  ORACLE_RED_ACTION,
  TASK_STATUS_LABEL,
} from '../sprints/constants/sprintConstants';
import RichTextDescriptionField from '../../components/common/RichTextDescriptionField';
import TaskDescriptionContent from '../../components/common/TaskDescriptionContent';
import { sanitizeRichDescriptionHtml } from '../../utils/richTextDescriptionUtils';
import {
  deleteTaskById,
  deleteUserTasksForTask,
  fetchTaskDetailBundle,
  fetchTaskDetailDevelopers,
  notifyNewAssignees,
  postUserTask,
  putTask,
} from './taskDetailApi';
import {
  formatDate,
  resolveProjectIdForDevelopers,
  taskDisplayName,
  userIdFromUserTaskRow,
} from '../sprints/utils/sprintUtils';
import {
  dateInputToEndOfLocalDayIso,
  dateInputToStartOfLocalDayIso,
  isoToDateInputValue,
  isDateInputOnOrBefore,
  normalizeTaskStatus,
  taskDetailSyncSignature,
  userTasksAssigneeSignature,
  userTaskRowStatus,
  userTaskRowTaskId,
} from './utils/taskUtils';
import { mergeUserTaskLists } from '../../utils/taskSyncEvents';
import { assigneeDeliveryStatus } from './utils/assigneeOnTimeUtils';
import {
  ASSIGNEE_IDENTITY_PALETTE,
  assigneeIdentityPaletteIndex,
} from './utils/assigneeIdentityPalette';
import { DELETE_TASK_CONFIRM_MESSAGE } from './constants/taskConstants';

const TYPE_OPTIONS = [
  {
    value: 'FEATURE',
    label: 'Feature',
    bg: '#EEEDFE',
    border: '#AFA9EC',
    color: '#3C3489',
    icon: '\u2726',
  },
  {
    value: 'BUG',
    label: 'Bug',
    bg: '#FCEBEB',
    border: '#F09595',
    color: '#791F1F',
    icon: '\u2B21',
  },
  {
    value: 'TASK',
    label: 'Task',
    bg: '#E6F1FB',
    border: '#85B7EB',
    color: '#0C447C',
    icon: '\u25FB',
  },
  {
    value: 'USER_STORY',
    label: 'User Story',
    bg: '#EAF3DE',
    border: '#97C459',
    color: '#27500A',
    icon: '\u25C8',
  },
];

const STATUS_OPTIONS = [
  {
    value: 'TODO',
    label: 'To Do',
    bg: '#F1EFE8',
    border: '#D3D1C7',
    color: '#5F5E5A',
    dot: '#888780',
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
  { value: 'LOW', label: 'Low', bg: '#EAF3DE', border: '#97C459', color: '#27500A' },
  { value: 'MEDIUM', label: 'Medium', bg: '#FAEEDA', border: '#FAC775', color: '#633806' },
  { value: 'HIGH', label: 'High', bg: '#FAECE7', border: '#F0997B', color: '#712B13' },
  { value: 'CRITICAL', label: 'Critical', bg: '#FCEBEB', border: '#F09595', color: '#791F1F' },
];

const CHIP_PALETTES_LIGHT = [
  { bg: '#EEEDFE', border: '#AFA9EC', color: '#3C3489' },
  { bg: '#E1F5EE', border: '#5DCAA5', color: '#085041' },
  { bg: '#FAEEDA', border: '#FAC775', color: '#633806' },
  { bg: '#FAECE7', border: '#F0997B', color: '#712B13' },
];

const CHIP_PALETTES_DARK = [
  { bg: '#2D2A4A', border: '#6A5ACD', color: '#B39DDB' },
  { bg: '#1A4A3A', border: '#4DB6AC', color: '#80CBC4' },
  { bg: '#4A2A1A', border: '#FFB74D', color: '#FFCC80' },
  { bg: '#4A1A1A', border: '#EF9A9A', color: '#FFAB91' },
];

// Shared fieldSx - ahora función
const getFieldSx = (isDark) => ({
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
  '& .MuiInputLabel-root': { fontSize: 13, color: isDark ? '#9A9A9A' : undefined },
  '& .MuiInputLabel-root.Mui-focused': { color: '#C74126' },
});

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
      <Typography
        sx={{
          fontSize: 11,
          fontWeight: 600,
          color: 'text.secondary',
          letterSpacing: '0.06em',
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

function FieldLabel({ children, color = '#1565C0' }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Typography
      sx={{
        fontSize: 11,
        fontWeight: 600,
        color: isDark ? '#90CAF9' : color,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        mb: 0.5,
      }}
    >
      {children}
    </Typography>
  );
}

function InfoCard({ children, accentColor = ORACLE_RED_ACTION, sx = {} }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 1.5, sm: 2.25 },
        borderRadius: '12px',
        border: `0.5px solid ${isDark ? '#2A2C32' : '#E8E8E8'}`,
        borderTop: `3px solid ${accentColor}`,
        bgcolor: 'background.paper',
        ...sx,
      }}
    >
      {children}
    </Paper>
  );
}

function SegmentedButtons({ options, value, onChange }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery('(max-width:600px)');
  return (
    <Box sx={{ display: 'flex', gap: isMobile ? 0.5 : 0.75, flexWrap: 'wrap' }}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <Box
            key={opt.value}
            component="button"
            onClick={() => onChange(opt.value)}
            sx={{
              flex: isMobile ? '1 1 auto' : 1,
              py: isMobile ? 0.75 : 0.875,
              px: 0.5,
              borderRadius: '8px',
              border: `1px solid ${active ? opt.border : isDark ? '#2A2C32' : '#E0E0E0'}`,
              bgcolor: active ? opt.bg : 'transparent',
              color: active ? opt.color : isDark ? '#9A9A9A' : 'text.secondary',
              fontSize: isMobile ? 11 : 13,
              fontWeight: active ? 600 : 500,
              cursor: 'pointer',
              transition: 'all 0.12s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.5,
              '&:hover': {
                bgcolor: active ? opt.bg : isDark ? '#2A2C32' : 'action.hover',
                borderColor: opt.border,
              },
            }}
          >
            {opt.dot && (
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: active ? opt.dot : isDark ? '#5A5A5A' : '#BDBDBD',
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
  const isMobile = useMediaQuery('(max-width:600px)');
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(4, 1fr)`, gap: isMobile ? 0.5 : 0.75 }}>
      {TYPE_OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <Box
            key={opt.value}
            component="button"
            onClick={() => onChange(opt.value)}
            sx={{
              py: isMobile ? 0.75 : 1,
              px: 0.5,
              borderRadius: '8px',
              border: `1px solid ${active ? opt.border : isDark ? '#2A2C32' : '#E0E0E0'}`,
              bgcolor: active ? opt.bg : 'transparent',
              color: active ? opt.color : isDark ? '#9A9A9A' : 'text.secondary',
              fontSize: isMobile ? 11 : 13,
              fontWeight: active ? 600 : 500,
              cursor: 'pointer',
              transition: 'all 0.12s',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.5,
              '&:hover': {
                bgcolor: active ? opt.bg : isDark ? '#2A2C32' : 'action.hover',
                borderColor: opt.border,
              },
            }}
          >
            <Box sx={{ fontSize: isMobile ? 14 : 16, lineHeight: 1 }}>{opt.icon}</Box>
            <Typography sx={{ fontSize: isMobile ? 10 : 13 }}>{opt.label}</Typography>
          </Box>
        );
      })}
    </Box>
  );
}

function userTasksForTaskId(rows, taskId) {
  const tid = Number(taskId);
  if (!Number.isFinite(tid)) return [];
  return (Array.isArray(rows) ? rows : []).filter((ut) => {
    const utTid = userTaskRowTaskId(ut);
    return Number.isFinite(utTid) && utTid === tid;
  });
}

function primaryAssigneeId(ids) {
  const list = finiteUserIds(Array.isArray(ids) ? ids : ids != null && ids !== '' ? [ids] : []);
  return list.length > 0 ? list[0] : '';
}

function assigneeStateFromUserTasks(list) {
  const rows = Array.isArray(list) ? list : [];
  const ids = [
    ...new Set(rows.map(userIdFromUserTaskRow).filter((id) => id != null && Number.isFinite(id))),
  ];
  const nameMap = {};
  rows.forEach((row) => {
    const uid = userIdFromUserTaskRow(row);
    if (uid == null) return;
    const nm = String(row?.user?.name ?? '').trim();
    if (nm) nameMap[String(uid)] = nm;
  });
  return { ids, nameMap, rows };
}

// ── Main component ────────────────────────────────────────────────────────────

export function TaskDetailDialog({
  open,
  initialTask,
  initialUserTasks,
  sprints,
  projectDevelopers,
  activeProjectId,
  onClose,
  onSaved,
  onDeleted,
  readOnly = false,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery('(max-width:600px)');
  const fieldSx = getFieldSx(isDark);
  const CHIP_PALETTES = isDark ? CHIP_PALETTES_DARK : CHIP_PALETTES_LIGHT;

  const [task, setTask] = useState(null);
  const [loadedAssigneeUserIds, setLoadedAssigneeUserIds] = useState([]);
  const [assigneeNamesByUserId, setAssigneeNamesByUserId] = useState({});
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [classification, setClassification] = useState('FEATURE');
  const [status, setStatus] = useState('TODO');
  const [priority, setPriority] = useState('MEDIUM');
  const [assignedHours, setAssignedHours] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [sprintId, setSprintId] = useState('');
  const [assignedUserId, setAssignedUserId] = useState('');
  const [pickerDevelopers, setPickerDevelopers] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [taskUserTasks, setTaskUserTasks] = useState([]);

  const sprintNumberMap = useMemo(() => {
    const map = new Map();
    [...(sprints || [])].sort((a, b) => a.id - b.id).forEach((s, i) => map.set(s.id, i + 1));
    return map;
  }, [sprints]);
  const resolvedDeveloperProjectId = useMemo(() => {
    const source =
      task && initialTask && Number(task.id) === Number(initialTask.id) ? task : initialTask;
    return resolveProjectIdForDevelopers(source, sprints, activeProjectId);
  }, [task, initialTask, sprints, activeProjectId]);

  useEffect(() => {
    if (!open || !editMode) {
      setPickerLoading(false);
      return;
    }
    const pid = resolvedDeveloperProjectId;
    if (pid == null) {
      setPickerDevelopers([]);
      setPickerLoading(false);
      return;
    }
    if (pickerDevelopers.length > 0) return;
    let cancelled = false;
    setPickerLoading(true);
    (async () => {
      try {
        const data = await fetchTaskDetailDevelopers(pid);
        if (!cancelled) setPickerDevelopers(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setPickerDevelopers([]);
      } finally {
        if (!cancelled) setPickerLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, editMode, resolvedDeveloperProjectId, pickerDevelopers.length]);

  const availableDevelopers = useMemo(() => {
    if (Array.isArray(pickerDevelopers) && pickerDevelopers.length > 0) return pickerDevelopers;
    return Array.isArray(projectDevelopers) ? projectDevelopers : [];
  }, [pickerDevelopers, projectDevelopers]);

  const taskSyncSig = useMemo(() => taskDetailSyncSignature(initialTask), [initialTask]);
  const assigneeSyncSig = useMemo(
    () => userTasksAssigneeSignature(initialUserTasks, initialTask?.id),
    [initialUserTasks, initialTask?.id],
  );

  const displayNameForAssignee = (uidRaw) => {
    const uid = normalizeUserId(uidRaw);
    if (uid == null || !Number.isFinite(uid)) return 'Unknown assignee';
    const fromDev = availableDevelopers.find((x) => developerNumericId(x) === uid);
    if (fromDev?.name) return String(fromDev.name).trim();
    const fromUt = assigneeNamesByUserId[String(uid)];
    if (fromUt) return fromUt;
    return `User #${uid}`;
  };

  useEffect(() => {
    if (!open) {
      setTask(null);
      setLoadedAssigneeUserIds([]);
      setAssigneeNamesByUserId({});
      setTaskUserTasks([]);
      setPickerDevelopers([]);
      setPickerLoading(false);
      setEditMode(false);
      setError('');
      return;
    }
    if (!initialTask?.id) return;

    setTask(initialTask);
    const cached = userTasksForTaskId(initialUserTasks, initialTask.id);
    if (cached.length > 0) {
      const { ids, nameMap, rows } = assigneeStateFromUserTasks(cached);
      setTaskUserTasks(rows);
      setAssigneeNamesByUserId(nameMap);
      setLoadedAssigneeUserIds(ids);
    }

    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { task: t, userTasks: utList } = await fetchTaskDetailBundle(initialTask.id);
        if (cancelled) return;
        const fromParent = userTasksForTaskId(initialUserTasks, initialTask.id);
        const mergedAssignees = mergeUserTaskLists(fromParent, Array.isArray(utList) ? utList : []);
        if (t) setTask({ ...t, ...initialTask });
        const { ids, nameMap, rows } = assigneeStateFromUserTasks(mergedAssignees);
        setTaskUserTasks(rows);
        setAssigneeNamesByUserId(nameMap);
        setLoadedAssigneeUserIds(ids);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, initialTask?.id, taskSyncSig, assigneeSyncSig, initialUserTasks]);

  useEffect(() => {
    if (!editMode) return;
    if (availableDevelopers.length === 0) return;
    setAssignedUserId((prev) => {
      const allowed = new Set(
        (availableDevelopers || [])
          .map((u) => developerNumericId(u))
          .filter((id) => id != null && Number.isFinite(id)),
      );
      const id = Number(prev);
      if (!Number.isFinite(id) || allowed.has(id)) return prev;
      return '';
    });
  }, [availableDevelopers, editMode]);

  const applyTaskToForm = (t) => {
    if (!t) return;
    setTitle(typeof t.title === 'string' ? t.title : '');
    setDescription(typeof t.description === 'string' ? t.description : '');
    setClassification(t.classification || 'FEATURE');
    setStatus(t.status === 'PENDING' ? 'TODO' : t.status || 'TODO');
    setPriority(t.priority || 'MEDIUM');
    setAssignedHours(t.assignedHours != null ? String(t.assignedHours) : '');
    setStartDate(isoToDateInputValue(t.startDate));
    setDueDate(isoToDateInputValue(t.dueDate));
    setSprintId(t.assignedSprint?.id != null ? String(t.assignedSprint.id) : '');
    setAssignedUserId(primaryAssigneeId(loadedAssigneeUserIds));
  };

  useEffect(() => {
    if (readOnly && editMode) setEditMode(false);
  }, [readOnly, editMode]);

  const handleStartEdit = () => {
    if (readOnly) return;
    if (!task) return;
    applyTaskToForm(task);
    setEditMode(true);
    setError('');
  };
  const handleCancelEdit = () => {
    if (task) applyTaskToForm(task);
    setEditMode(false);
    setError('');
  };

  const handleSave = async () => {
    if (!task) return;
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    if (!startDate || !dueDate) {
      setError('Start and due dates are required.');
      return;
    }
    if (!sprintId) {
      setError('Sprint is required.');
      return;
    }
    if (!isDateInputOnOrBefore(startDate, dueDate)) {
      setError('Start date must be on or before due date.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const nextId = primaryAssigneeId(assignedUserId);
      const prevId = primaryAssigneeId(loadedAssigneeUserIds);
      const nextIds = nextId !== '' ? [nextId] : [];
      const prevIds = prevId !== '' ? [prevId] : [];
      const assigneesChanged = nextId !== prevId;
      const newlyAddedAssigneeIds =
        assigneesChanged && nextId !== '' && nextId !== prevId && !prevIds.includes(nextId)
          ? [nextId]
          : [];
      const sameSet = !assigneesChanged;
      if (!sameSet) {
        const tid = task.id;
        if (nextIds.length === 0) {
          if (prevIds.length > 0) {
            const delRes = await deleteUserTasksForTask(tid);
            if (!delRes.ok) {
              setError('Could not update assignees.');
              return;
            }
            setLoadedAssigneeUserIds([]);
            setTaskUserTasks([]);
          }
        } else {
          const delRes = await deleteUserTasksForTask(tid);
          if (!delRes.ok) {
            setError('Could not update assignees.');
            return;
          }
          const posts = await Promise.all(
            nextIds.map((uid) => postUserTask({ userId: uid, taskId: tid, status })),
          );
          if (posts.some((r) => !r.ok)) {
            setError('Could not update assignees.');
            return;
          }
          if (newlyAddedAssigneeIds.length > 0) {
            try {
              await notifyNewAssignees(tid, newlyAddedAssigneeIds);
            } catch {
              /* assignment saved; email is best-effort */
            }
          }
          setLoadedAssigneeUserIds(nextIds);
          // Avoid extra round-trip before PUT; list view refreshes via parent loadData.
          setTaskUserTasks(
            nextIds.map((userId) => ({
              user: { id: userId, name: displayNameForAssignee(userId) },
              task: { id: tid },
              status,
            })),
          );
        }
      }
      const { finishDate: _omitFinish, ...taskRest } = task;
      const payload = {
        ...taskRest,
        title: title.trim(),
        description: sanitizeRichDescriptionHtml(description),
        classification,
        status,
        priority,
        assignedHours: assignedHours === '' ? null : Number(assignedHours),
        startDate: dateInputToStartOfLocalDayIso(startDate),
        dueDate: dateInputToEndOfLocalDayIso(dueDate),
        assignedSprint: { id: Number(sprintId) },
      };
      const res = await putTask(task.id, payload);
      if (res.ok) {
        let body = null;
        try {
          body = await res.json();
        } catch {
          body = null;
        }
        const updated =
          body && typeof body === 'object' && !Array.isArray(body)
            ? { ...task, ...body }
            : { ...task, ...payload };
        setTask(updated);
        const stillHasAssignees = nextId !== '';
        let saveMeta;
        if (assigneesChanged) {
          saveMeta = { assigneesChanged: true, assigneeUserIds: nextIds };
        } else if (stillHasAssignees && updated?.status != null) {
          saveMeta = { syncAssignmentStatuses: true, assignmentStatus: updated.status };
        } else {
          saveMeta = undefined;
        }
        onSaved?.(updated, saveMeta);
        onClose();
      } else if (res.status === 409) {
        setError(
          'Cannot set this task to Done until every assigned developer is marked complete, or change assignees first.',
        );
      } else {
        setError('Could not save changes.');
      }
    } catch {
      setError('Connection error.');
    } finally {
      setSaving(false);
    }
  };

  const handleDialogClose = () => {
    if (!saving) onClose();
  };

  const handleDeleteTask = async () => {
    if (!task?.id) return;
    if (!window.confirm(DELETE_TASK_CONFIRM_MESSAGE)) return;
    setSaving(true);
    setError('');
    try {
      const res = await deleteTaskById(task.id);
      if (res.ok) {
        const tid = Number(task.id);
        onDeleted?.(tid);
        onClose();
      } else {
        setError('Could not delete task.');
      }
    } catch {
      setError('Connection error.');
    } finally {
      setSaving(false);
    }
  };

  const statusLabel = task ? (TASK_STATUS_LABEL[task.status] ?? task.status) : '';
  const viewAssigneeIds = useMemo(
    () => finiteUserIds(loadedAssigneeUserIds),
    [loadedAssigneeUserIds],
  );
  const editAssigneeId = useMemo(() => primaryAssigneeId(assignedUserId), [assignedUserId]);

  const assigneeTaskMeta = useMemo(
    () => ({
      finishDate: task?.finishDate ?? task?.finish_date,
      assigneeCount: taskUserTasks.length || viewAssigneeIds.length || 1,
    }),
    [task?.finishDate, task?.finish_date, taskUserTasks.length, viewAssigneeIds.length],
  );

  const detailLoading = open && !task;
  const showPerAssigneeDelivery = taskUserTasks.length > 1;

  // Derive active status/type/priority option for view mode badges
  const statusOpt = STATUS_OPTIONS.find((o) => o.value === task?.status) ?? STATUS_OPTIONS[0];
  const typeOpt = TYPE_OPTIONS.find((o) => o.value === task?.classification) ?? TYPE_OPTIONS[0];
  const priorityOpt =
    PRIORITY_OPTIONS.find((o) => o.value === task?.priority) ?? PRIORITY_OPTIONS[1];

  // Responsive padding and margins
  const dialogContentPx = isMobile ? 2 : 3;
  const headerPx = isMobile ? 2 : 2.5;
  const headerPt = isMobile ? 1.5 : 2;
  const headerPb = isMobile ? 1.25 : 1.75;
  const buttonSize = isMobile ? 'small' : 'medium';

  return (
    <Dialog
      open={open}
      onClose={handleDialogClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
      PaperProps={{
        elevation: 0,
        sx: {
          borderRadius: '16px',
          border: `1px solid ${isDark ? '#2A2C32' : '#ECECEC'}`,
          bgcolor: 'background.paper',
          overflow: 'hidden',
          maxWidth: { xs: 'calc(100% - 16px)', sm: 720 },
          margin: { xs: 1, sm: 'auto' },
        },
      }}
    >
      {/* ── Header ── */}
      <DialogTitle sx={{ p: 0 }}>
        <Box
          sx={{
            bgcolor: ORACLE_RED_ACTION,
            px: headerPx,
            pt: headerPt,
            pb: headerPb,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: isMobile ? 1 : 1.5 }}>
            <Box
              sx={{
                width: isMobile ? 32 : 38,
                height: isMobile ? 32 : 38,
                borderRadius: '10px',
                bgcolor: 'rgba(255,255,255,0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <AssignmentOutlinedIcon sx={{ color: '#fff', fontSize: isMobile ? 18 : 20 }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 600, color: '#fff', fontSize: isMobile ? 13 : 15, lineHeight: 1.2 }}>
                {editMode ? 'Edit task' : 'Task details'}
              </Typography>
              {task?.id != null && (
                <Typography
                  sx={{ fontSize: isMobile ? 11 : 13, color: 'rgba(255,255,255,0.72)', display: 'block' }}
                >
                  ID #{task.id}
                </Typography>
              )}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
            {!readOnly && !editMode && task && (
              <>
                <Button
                  variant="contained"
                  startIcon={<EditIcon sx={{ fontSize: isMobile ? '13px !important' : '15px !important' }} />}
                  onClick={handleStartEdit}
                  disableElevation
                  size={buttonSize}
                  sx={{
                    fontSize: isMobile ? 11 : 13,
                    bgcolor: 'rgba(255,255,255,0.22)',
                    color: '#fff',
                    textTransform: 'none',
                    fontWeight: 600,
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.35)',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.32)' },
                    px: isMobile ? 1.5 : 2,
                    py: isMobile ? 0.5 : 0.75,
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<DeleteOutlineIcon sx={{ fontSize: isMobile ? '13px !important' : '15px !important' }} />}
                  onClick={handleDeleteTask}
                  disabled={saving}
                  size={buttonSize}
                  sx={{
                    fontSize: isMobile ? 11 : 13,
                    color: 'rgba(255,255,255,0.85)',
                    borderColor: 'rgba(255,255,255,0.4)',
                    textTransform: 'none',
                    fontWeight: 600,
                    borderRadius: '8px',
                    '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.1)' },
                    px: isMobile ? 1.5 : 2,
                    py: isMobile ? 0.5 : 0.75,
                  }}
                >
                  Delete
                </Button>
              </>
            )}
            <IconButton
              onClick={handleDialogClose}
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
        </Box>
      </DialogTitle>

      {/* ── Body ── */}
      <DialogContent
        sx={{
          pt: isMobile ? '24px !important' : '32px !important',
          px: dialogContentPx,
          pb: isMobile ? 1.5 : 2,
          overflowY: 'auto',
          bgcolor: isDark ? '#111214' : '#FAFAFA',
        }}
      >
        {detailLoading && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 8,
              gap: 2,
            }}
          >
            <CircularProgress size={36} sx={{ color: ORACLE_RED }} />
            <Typography variant="body2" color="text.secondary">
              Loading task details…
            </Typography>
          </Box>
        )}

        {/* ── VIEW MODE ── */}
        {task && !editMode && !detailLoading && (
          <Stack spacing={isMobile ? 1.5 : 2}>
            {/* Overview card */}
            <InfoCard accentColor={ORACLE_RED_ACTION}>
              <SectionLabel>Overview</SectionLabel>

              <FieldLabel>Title</FieldLabel>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary', mb: isMobile ? 1.5 : 2 }}>
                {taskDisplayName(task)}
              </Typography>

              <FieldLabel>Description</FieldLabel>
              <Box sx={{ mb: 2 }}>
                <TaskDescriptionContent description={task.description} />
              </Box>

              {/* Status / Type / Priority as colored badges */}
              <Stack direction="row" spacing={isMobile ? 0.75 : 1} flexWrap="wrap" sx={{ gap: isMobile ? 0.75 : 1 }}>
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5,
                    px: isMobile ? 1 : 1.25,
                    py: isMobile ? 0.4 : 0.5,
                    borderRadius: '20px',
                    bgcolor: typeOpt.bg,
                    border: `1px solid ${typeOpt.border}`,
                    color: typeOpt.color,
                    fontSize: isMobile ? 10 : 12,
                    fontWeight: 600,
                  }}
                >
                  {typeOpt.icon} {typeOpt.label}
                </Box>
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5,
                    px: isMobile ? 1 : 1.25,
                    py: isMobile ? 0.4 : 0.5,
                    borderRadius: '20px',
                    bgcolor: statusOpt.bg,
                    border: `1px solid ${statusOpt.border}`,
                    color: statusOpt.color,
                    fontSize: isMobile ? 10 : 12,
                    fontWeight: 600,
                  }}
                >
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: statusOpt.dot }} />
                  {statusLabel}
                </Box>
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    px: isMobile ? 1 : 1.25,
                    py: isMobile ? 0.4 : 0.5,
                    borderRadius: '20px',
                    bgcolor: priorityOpt.bg,
                    border: `1px solid ${priorityOpt.border}`,
                    color: priorityOpt.color,
                    fontSize: isMobile ? 10 : 12,
                    fontWeight: 600,
                  }}
                >
                  {priorityOpt.label}
                </Box>
                {task.assignedHours != null && (
                  <Box
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      px: isMobile ? 1 : 1.25,
                      py: isMobile ? 0.4 : 0.5,
                      borderRadius: '20px',
                      bgcolor: isDark ? '#1A4A3A' : '#E1F5EE',
                      border: `1px solid ${isDark ? '#4DB6AC' : '#5DCAA5'}`,
                      color: isDark ? '#80CBC4' : '#085041',
                      fontSize: isMobile ? 10 : 12,
                      fontWeight: 600,
                    }}
                  >
                    {task.assignedHours}h assigned
                  </Box>
                )}
              </Stack>
            </InfoCard>

            {/* Planning card */}
            <InfoCard accentColor="#5C6BC0">
              <SectionLabel>Planning</SectionLabel>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: isMobile ? 1.5 : 2, mb: 2 }}>
                <Box>
                  <FieldLabel color="#5C6BC0">Sprint</FieldLabel>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }}>
                    {task.assignedSprint?.id != null
                      ? `Sprint ${sprintNumberMap.get(task.assignedSprint.id) ?? task.assignedSprint.id}`
                      : '—'}
                  </Typography>
                </Box>
                <Box>
                  <FieldLabel color="#5C6BC0">Assigned to</FieldLabel>
                  {viewAssigneeIds.length ? (
                    <Stack direction="row" flexWrap="wrap" spacing={0.5} sx={{ mt: 0.25 }}>
                      {viewAssigneeIds.map((uidRaw, i) => {
                        const name = displayNameForAssignee(uidRaw);
                        const pal = CHIP_PALETTES[i % CHIP_PALETTES.length];
                        return (
                          <Box
                            key={String(uidRaw)}
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              px: isMobile ? 0.75 : 1,
                              py: isMobile ? 0.3 : 0.4,
                              borderRadius: '20px',
                              bgcolor: pal.bg,
                              border: `1px solid ${pal.border}`,
                              color: pal.color,
                              fontSize: isMobile ? 10 : 12,
                              fontWeight: 600,
                            }}
                          >
                            {name}
                          </Box>
                        );
                      })}
                    </Stack>
                  ) : (
                    <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>—</Typography>
                  )}
                </Box>
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: isMobile ? 1 : 1.5 }}>
                <Box
                  sx={{
                    p: isMobile ? 1 : 1.5,
                    borderRadius: '10px',
                    bgcolor: isDark ? '#4A2A1A' : '#FAEEDA',
                    border: `1px solid ${isDark ? '#FFB74D' : '#FAC775'}`,
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: isDark ? '#FFCC80' : '#854F0B',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Start date
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: isMobile ? 12 : 13,
                      fontWeight: 600,
                      color: isDark ? '#FFE0B2' : '#412402',
                      mt: 0.5,
                    }}
                  >
                    {formatDate(task.startDate)}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    p: isMobile ? 1 : 1.5,
                    borderRadius: '10px',
                    bgcolor: isDark ? '#1A3A5C' : '#E6F1FB',
                    border: `1px solid ${isDark ? '#64B5F6' : '#85B7EB'}`,
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: isDark ? '#90CAF9' : '#185FA5',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Due date
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: isMobile ? 12 : 13,
                      fontWeight: 600,
                      color: isDark ? '#BBDEFB' : '#042C53',
                      mt: 0.5,
                    }}
                  >
                    {formatDate(task.dueDate)}
                  </Typography>
                </Box>
              </Box>
            </InfoCard>

            {/* On-time per developer only when several assignees share the task */}
            {showPerAssigneeDelivery && (
              <InfoCard accentColor="#5C6BC0">
                <SectionLabel>Delivery by assignee</SectionLabel>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mb: 1, fontSize: isMobile ? 10 : 12 }}
                >
                  Each row shows whether that developer finished their part on or before the due
                  date.
                </Typography>
                <Stack spacing={0.75}>
                  {[...taskUserTasks]
                    .map((ut) => {
                      const uid = userIdFromUserTaskRow(ut);
                      const name = displayNameForAssignee(uid);
                      const hrs =
                        Number(ut?.workedHours ?? ut?.worked_hours ?? ut?.hours ?? 0) || 0;
                      return { ut, uid, name, hrs };
                    })
                    .sort((a, b) =>
                      String(a.name).localeCompare(String(b.name), undefined, {
                        sensitivity: 'base',
                      }),
                    )
                    .map(({ ut, uid, name, hrs }) => {
                      const assigneeStatusKey = normalizeTaskStatus(userTaskRowStatus(ut));
                      const statusChip =
                        STATUS_OPTIONS.find((o) => o.value === assigneeStatusKey) ??
                        STATUS_OPTIONS[0];
                      const pal =
                        ASSIGNEE_IDENTITY_PALETTE[
                          assigneeIdentityPaletteIndex({ userId: uid, name })
                        ];
                      const delivery = assigneeDeliveryStatus(ut, task?.dueDate, assigneeTaskMeta);
                      const deliveryToneSx = {
                        onTime: {
                          color: '#1B5E20',
                          bgcolor: isDark ? '#1A4A2A' : '#E8F5E9',
                          border: '#43A047',
                        },
                        late: {
                          color: '#B71C1C',
                          bgcolor: isDark ? '#4A1A1A' : '#FFEBEE',
                          border: '#E53935',
                        },
                        pending: {
                          color: isDark ? '#9E9E9E' : '#616161',
                          bgcolor: isDark ? '#2A2C32' : '#F5F5F5',
                          border: isDark ? '#5A5A5A' : '#BDBDBD',
                        },
                        unknown: {
                          color: isDark ? '#FFB74D' : '#E65100',
                          bgcolor: isDark ? '#4A2A1A' : '#FFF3E0',
                          border: '#FB8C00',
                        },
                      };
                      const tone = deliveryToneSx[delivery.tone] ?? deliveryToneSx.pending;
                      return (
                        <Box
                          key={`${uid ?? 'x'}-${ut?.id?.taskId ?? task.id}`}
                          sx={{
                            py: 0.5,
                            borderBottom: `0.5px solid ${isDark ? '#2A2C32' : '#EEEEEE'}`,
                            '&:last-of-type': { borderBottom: 'none' },
                          }}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: isMobile ? 0.5 : 1,
                              flexWrap: isMobile ? 'wrap' : 'nowrap',
                            }}
                          >
                            <Box
                              sx={{
                                flex: 1,
                                minWidth: 0,
                                display: 'flex',
                                alignItems: 'center',
                                borderRadius: '8px',
                                overflow: 'hidden',
                                border: `0.5px solid ${isDark ? '#2A2C32' : 'rgba(0,0,0,0.08)'}`,
                              }}
                            >
                              <Box
                                sx={{
                                  flex: 1,
                                  minWidth: 0,
                                  pl: 1,
                                  pr: 0.5,
                                  py: 0.6,
                                  bgcolor: pal.light,
                                  borderLeft: `3px solid ${pal.strip}`,
                                  color: pal.name,
                                  fontSize: isMobile ? 11 : 13,
                                  fontWeight: 600,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {name}
                              </Box>
                              <Box
                                sx={{
                                  flexShrink: 0,
                                  px: isMobile ? 0.75 : 1,
                                  py: 0.6,
                                  fontSize: isMobile ? 9 : 11,
                                  fontWeight: 600,
                                  letterSpacing: '0.04em',
                                  color: statusChip.color,
                                  bgcolor: statusChip.bg,
                                  borderLeft: `3px solid ${statusChip.dot}`,
                                }}
                              >
                                {statusChip.label}
                              </Box>
                              <Box
                                sx={{
                                  flexShrink: 0,
                                  px: isMobile ? 0.75 : 1,
                                  py: 0.6,
                                  fontSize: isMobile ? 9 : 11,
                                  fontWeight: 700,
                                  color: tone.color,
                                  bgcolor: tone.bgcolor,
                                  borderLeft: `3px solid ${tone.border}`,
                                }}
                              >
                                {delivery.label}
                              </Box>
                            </Box>
                            {delivery.complete && delivery.completedAt && (
                              <Typography
                                variant="caption"
                                sx={{
                                  flexShrink: 0,
                                  color: 'text.secondary',
                                  fontSize: isMobile ? 9 : 11,
                                  minWidth: isMobile ? 60 : 72,
                                  textAlign: 'right',
                                }}
                              >
                                {formatDate(delivery.completedAt)}
                              </Typography>
                            )}
                            {hrs > 0 && (
                              <Box
                                sx={{
                                  px: isMobile ? 0.75 : 1,
                                  py: isMobile ? 0.3 : 0.4,
                                  borderRadius: '20px',
                                  bgcolor: isDark ? '#1A3A5C' : '#E6F1FB',
                                  border: `1px solid ${isDark ? '#64B5F6' : '#85B7EB'}`,
                                  color: isDark ? '#90CAF9' : '#0C447C',
                                  fontSize: isMobile ? 10 : 12,
                                  fontWeight: 600,
                                  flexShrink: 0,
                                }}
                              >
                                {hrs}h
                              </Box>
                            )}
                          </Box>
                          {delivery.hint && (
                            <Typography
                              variant="caption"
                              sx={{
                                display: 'block',
                                pl: 0.5,
                                mt: 0.35,
                                color: isDark ? '#FFB74D' : '#E65100',
                                fontSize: isMobile ? 9 : 11,
                              }}
                            >
                              {delivery.hint}
                            </Typography>
                          )}
                        </Box>
                      );
                    })}
                </Stack>
              </InfoCard>
            )}
          </Stack>
        )}

        {/* ── EDIT MODE ── */}
        {task && editMode && (
          <Stack spacing={isMobile ? 1.5 : 2}>
            <InfoCard accentColor={ORACLE_RED_ACTION}>
              <SectionLabel>Overview</SectionLabel>
              <Stack spacing={isMobile ? 1.5 : 2}>
                <TextField
                  label="Task title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  fullWidth
                  multiline
                  minRows={2}
                  size="small"
                  sx={fieldSx}
                />
                <RichTextDescriptionField
                  label="Description"
                  value={description}
                  onChange={setDescription}
                  minRows={isMobile ? 3 : 3}
                  sx={fieldSx}
                />
                <Box>
                  <SectionLabel>Work item type</SectionLabel>
                  <TypeGrid value={classification} onChange={setClassification} />
                </Box>
                <Box>
                  <SectionLabel>Priority</SectionLabel>
                  <SegmentedButtons
                    options={PRIORITY_OPTIONS}
                    value={priority}
                    onChange={setPriority}
                  />
                </Box>
              </Stack>
            </InfoCard>

            <InfoCard accentColor="#5C6BC0">
              <SectionLabel>Planning</SectionLabel>
              <Stack spacing={isMobile ? 1.5 : 2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={isMobile ? 1 : 1.5}>
                  <FormControl size="small" fullWidth sx={fieldSx}>
                    <InputLabel>Sprint</InputLabel>
                    <Select
                      value={sprintId}
                      onChange={(e) => setSprintId(e.target.value)}
                      label="Sprint"
                    >
                      {sprints.map((s) => (
                        <MenuItem key={s.id} value={String(s.id)}>
                          {`Sprint ${sprintNumberMap.get(s.id) ?? s.id}`}
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
                    sx={fieldSx}
                  />
                </Stack>

                <FormControl fullWidth size="small" sx={fieldSx}>
                  <InputLabel id="task-assignees-label">Assigned to</InputLabel>
                  <Select
                    labelId="task-assignees-label"
                    value={editAssigneeId}
                    onChange={(e) => setAssignedUserId(e.target.value)}
                    label="Assigned to"
                    renderValue={(value) =>
                      value ? (
                        displayNameForAssignee(value)
                      ) : (
                        <Typography sx={{ fontSize: 13, color: 'text.disabled' }}>
                          Unassigned
                        </Typography>
                      )
                    }
                    MenuProps={{ PaperProps: { style: { maxHeight: 280 } } }}
                  >
                    <MenuItem value="">
                      <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Unassigned</Typography>
                    </MenuItem>
                    {availableDevelopers.map((u) => {
                      const uid = developerNumericId(u);
                      if (uid == null || !Number.isFinite(uid)) return null;
                      return (
                        <MenuItem key={uid} value={uid} sx={{ fontSize: 13 }}>
                          {u.name}
                        </MenuItem>
                      );
                    })}
                  </Select>
                  {editMode && pickerLoading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                      <CircularProgress size={22} sx={{ color: ORACLE_RED_ACTION }} />
                    </Box>
                  )}
                  {editMode && !pickerLoading && resolvedDeveloperProjectId == null && (
                    <Typography
                      sx={{
                        fontSize: 12,
                        display: 'block',
                        mt: 0.75,
                        color: '#C62828',
                        fontWeight: 600,
                      }}
                    >
                      Could not determine the project for this task. Select a project or fix the
                      task sprint.
                    </Typography>
                  )}
                  {editMode &&
                    !pickerLoading &&
                    resolvedDeveloperProjectId != null &&
                    availableDevelopers.length === 0 && (
                      <Typography
                        sx={{ fontSize: 12, display: 'block', mt: 0.75, color: 'text.secondary' }}
                      >
                        {`No developers returned for project #${resolvedDeveloperProjectId}.`}
                      </Typography>
                    )}
                </FormControl>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={isMobile ? 1 : 1.5}>
                  <TextField
                    label="Start date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                    size="small"
                    sx={fieldSx}
                  />
                  <TextField
                    label="Due date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                    size="small"
                    sx={fieldSx}
                  />
                </Stack>
              </Stack>
            </InfoCard>

            {error && (
              <Typography sx={{ fontSize: 12, color: '#C62828', fontWeight: 600 }}>
                {error}
              </Typography>
            )}
          </Stack>
        )}
      </DialogContent>

      {/* ── Footer ── */}
      <DialogActions
        sx={{
          px: isMobile ? 2 : 3,
          py: isMobile ? 1 : 1.5,
          gap: isMobile ? 0.75 : 1,
          borderTop: `1px solid ${isDark ? '#2A2C32' : '#F0F0F0'}`,
          bgcolor: isDark ? '#111214' : '#FAFAFA',
          justifyContent: editMode ? 'space-between' : 'flex-end',
          flexWrap: isMobile ? 'wrap' : 'nowrap',
        }}
      >
        {editMode ? (
          <>
            <Typography sx={{ fontSize: isMobile ? 10 : 12, color: 'text.disabled' }}>
              Unsaved changes will be lost on cancel
            </Typography>
            <Box sx={{ display: 'flex', gap: isMobile ? 0.75 : 1 }}>
              <Button
                onClick={handleCancelEdit}
                disabled={saving}
                size={buttonSize}
                sx={{
                  fontSize: isMobile ? 11 : 13,
                  color: 'text.secondary',
                  textTransform: 'none',
                  fontWeight: 600,
                  borderRadius: '8px',
                  border: `1px solid ${isDark ? '#2A2C32' : '#E0E0E0'}`,
                  px: isMobile ? 1.5 : 2,
                  '&:hover': { bgcolor: isDark ? '#2A2C32' : '#F5F5F5' },
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                variant="contained"
                disableElevation
                startIcon={<SaveOutlinedIcon sx={{ fontSize: isMobile ? '14px !important' : '16px !important' }} />}
                size={buttonSize}
                sx={{
                  fontSize: isMobile ? 11 : 13,
                  bgcolor: ORACLE_RED_ACTION,
                  textTransform: 'none',
                  fontWeight: 600,
                  borderRadius: '8px',
                  px: isMobile ? 2 : 2.5,
                  '&:hover': { bgcolor: '#A83B2D' },
                  '&.Mui-disabled': { bgcolor: '#EFEBE9', color: '#BCAAA4' },
                }}
              >
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </Box>
          </>
        ) : (
          <Button
            onClick={handleDialogClose}
            size={buttonSize}
            sx={{
              fontSize: isMobile ? 11 : 13,
              color: 'text.secondary',
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: '8px',
              border: `1px solid ${isDark ? '#2A2C32' : '#E0E0E0'}`,
              px: isMobile ? 2 : 2.5,
              '&:hover': { bgcolor: isDark ? '#2A2C32' : '#F5F5F5' },
            }}
          >
            Close
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}