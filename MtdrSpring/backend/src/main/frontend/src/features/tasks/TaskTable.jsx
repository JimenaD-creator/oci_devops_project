import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Button,
  TableHead,
  Typography,
  Stack,
  Box,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  ASSIGNEE_IDENTITY_PALETTE,
  assigneeIdentityPaletteIndex,
} from './utils/assigneeIdentityPalette';
import { DeleteIcon } from 'lucide-react';
import { UndoIcon } from 'lucide-react';
import { DEVELOPER_DISPLAY_NAME } from '../dashboard/dashboardSprintData';

export const DEV_COLORS = {
  developer1: { bg: '#E3F2FD', color: '#0D47A1', label: 'Dev 1' },
  developer2: { bg: '#E8F5E9', color: '#1B5E20', label: 'Dev 2' },
  developer3: { bg: '#FFF3E0', color: '#E65100', label: 'Dev 3' },
  developer4: { bg: '#FCE4EC', color: '#AD1457', label: 'Dev 4' },
  developer5: { bg: '#EDE7F6', color: '#4527A0', label: 'Dev 5' },
};

/** Label for chips and UI: canonical team names first, then legacy Dev N, else raw. */
export function getDeveloperLabel(developer) {
  if (!developer) return 'Unassigned';
  if (DEVELOPER_DISPLAY_NAME[developer]) return DEVELOPER_DISPLAY_NAME[developer];
  const byFullName = Object.entries(DEVELOPER_DISPLAY_NAME).find(([, name]) => name === developer);
  if (byFullName) return byFullName[1];
  if (DEV_COLORS[developer]) return DEV_COLORS[developer].label;
  return String(developer).replace(/_/g, ' ');
}

function OnTimeChip({ item, isDark }) {
  const onTime = completionOnTimeDisplay(item);
  if (onTime === '—') {
    return (
      <Typography variant="caption" sx={{ color: isDark ? '#5A5A5A' : '#BBB' }}>
        —
      </Typography>
    );
  }
  const ok = onTime === 'Yes';
  return (
    <Chip
      label={ok ? 'Yes' : 'No'}
      size="small"
      sx={{
        bgcolor: ok ? (isDark ? '#1A4A2A' : '#E8F5E9') : (isDark ? '#4A1A1A' : '#FFEBEE'),
        color: ok ? '#2E7D32' : '#C62828',
        fontWeight: 700,
        fontSize: '0.7rem',
        height: 20,
      }}
    />
  );
}

function resolveDeveloperName(developer) {
  if (!developer) return null;
  if (typeof developer === 'string') return developer.trim();
  if (typeof developer === 'object') {
    return (
      developer.name ||
      developer.NAME ||
      developer.fullName ||
      developer.displayName ||
      developer.email ||
      developer.userName ||
      developer.username ||
      developer.user?.name ||
      developer.user?.NAME ||
      developer.user?.email ||
      String(developer.id || developer.ID || developer.userId || developer.USER_ID || '')
    );
  }
  return String(developer);
}

function DevChip({ developer, isDark }) {
  const resolved = resolveDeveloperName(developer);
  const d = DEV_COLORS[resolved];
  const label = getDeveloperLabel(resolved);
  const pickFromName = (name) => {
    const palettes = [
      { bg: '#E3F2FD', color: '#0D47A1' },
      { bg: '#E8F5E9', color: '#1B5E20' },
      { bg: '#FFF3E0', color: '#E65100' },
      { bg: '#F3E5F5', color: '#6A1B9A' },
      { bg: '#E0F2F1', color: '#00695C' },
      { bg: '#FCE4EC', color: '#AD1457' },
      { bg: '#FFF9C4', color: '#F57F17' },
      { bg: '#E8EAF6', color: '#283593' },
      { bg: '#F1F8E9', color: '#33691E' },
      { bg: '#FBE9E7', color: '#BF360C' },
      { bg: '#E0F7FA', color: '#006064' },
      { bg: '#EDE7F6', color: '#4527A0' },
    ];
    const src = String(name || '');
    let h = 5381;
    for (let i = 0; i < src.length; i += 1) {
      h = (Math.imul(h, 33) ^ src.charCodeAt(i)) >>> 0;
    }
    return palettes[h % palettes.length];
  };
  const palette = d ?? pickFromName(label);
  const style = { bgcolor: palette.bg, color: palette.color };
  if (!resolved)
    return (
      <Typography variant="caption" sx={{ color: isDark ? '#5A5A5A' : '#BBB' }}>
        —
      </Typography>
    );
  return (
    <Chip
      label={label}
      size="small"
      sx={{
        ...style,
        fontWeight: 800,
        fontSize: '0.72rem',
        height: 24,
        border: `1px solid ${palette.color}33`,
      }}
    />
  );
}

function DevelopersCell({ developers, developer, assigneeProgress, managerView, isDark }) {
  const theme = useTheme();
  const darkMode = theme.palette.mode === 'dark';
  
  if (managerView && Array.isArray(assigneeProgress) && assigneeProgress.length > 1) {
    return (
      <Stack spacing={0.45} sx={{ py: 0.25 }}>
        {assigneeProgress.map((row) => {
          const key =
            row.userId != null && Number.isFinite(row.userId) ? `u-${row.userId}` : row.name;
          const pal = ASSIGNEE_IDENTITY_PALETTE[assigneeIdentityPaletteIndex(row)];
          return (
            <Box
              key={key}
              title={
                row.completed
                  ? 'This developer marked their part complete'
                  : 'Waiting on this developer'
              }
              sx={{
                display: 'flex',
                alignItems: 'stretch',
                maxWidth: '100%',
                minHeight: 24,
                borderRadius: '10px',
                overflow: 'hidden',
                border: `1px solid ${darkMode ? '#2A2C32' : 'rgba(0,0,0,0.1)'}`,
                boxShadow: `0 1px 2px ${darkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.06)'}`,
              }}
            >
              <Box
                sx={{
                  flex: 1,
                  minWidth: 0,
                  pl: 0.85,
                  pr: 0.5,
                  py: 0.35,
                  display: 'flex',
                  alignItems: 'center',
                  bgcolor: pal.light,
                  borderLeft: `4px solid ${pal.strip}`,
                  color: pal.name,
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {row.name}
              </Box>
              <Box
                sx={{
                  flexShrink: 0,
                  px: 0.7,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.58rem',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  writingMode: 'horizontal-tb',
                  color: '#fff',
                  bgcolor: row.completed ? '#1B5E20' : '#E65100',
                  borderLeft: row.completed
                    ? '1px solid rgba(255,255,255,0.25)'
                    : '1px solid rgba(0,0,0,0.08)',
                }}
              >
                {row.completed ? 'Done' : 'Pending'}
              </Box>
            </Box>
          );
        })}
      </Stack>
    );
  }
  const list = Array.isArray(developers)
    ? developers.map(resolveDeveloperName).filter(Boolean)
    : [resolveDeveloperName(developer)].filter(Boolean);
  if (list.length === 0)
    return (
      <Typography variant="caption" sx={{ color: darkMode ? '#5A5A5A' : '#BBB' }}>
        —
      </Typography>
    );
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {list.map((name, idx) => (
        <DevChip key={`${name}-${idx}`} developer={name} isDark={darkMode} />
      ))}
    </div>
  );
}

function fmtDate(d) {
  if (!d) return '-';
  return String(d).slice(0, 10);
}

function toTimeMs(raw) {
  if (!raw) return null;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : null;
}

function normalizeStatus(value) {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (normalized === 'IN_PROCESS') return 'IN_PROGRESS';
  if (normalized === 'TO_DO') return 'TODO';
  return normalized;
}

function isCompletedStatus(item) {
  const st = normalizeStatus(item.statusRaw ?? item.status);
  return st === 'DONE' || st === 'COMPLETED';
}

function completionOnTimeDisplay(item) {
  const dueMs = toTimeMs(item.dueDate);
  const finishMs = toTimeMs(item.completedAt ?? item.completed_at);
  if (!isCompletedStatus(item) || dueMs == null || finishMs == null) return '—';
  return finishMs <= dueMs ? 'Yes' : 'No';
}

function statusText(item) {
  const normalized = normalizeStatus(item.statusRaw ?? item.status);
  if (normalized === 'DONE' || normalized === 'COMPLETED') return 'Done';
  if (normalized === 'IN_PROGRESS') return 'In Progress';
  if (normalized === 'IN_REVIEW') return 'In Review';
  if (normalized === 'TODO' || normalized === 'PENDING') return 'To Do';
  const raw = String(item.statusRaw ?? item.status ?? '').trim();
  return raw ? raw.replace(/_/g, ' ') : 'Unknown';
}

function taskStatusChipProps(item, isDark) {
  const st = normalizeStatus(item.statusRaw ?? item.status);
  if (st === 'DONE' || st === 'COMPLETED') {
    return { label: statusText(item), bgcolor: isDark ? '#1A4A2A' : '#E8F5E9', color: '#1B5E20' };
  }
  if (st === 'IN_PROGRESS') {
    return { label: statusText(item), bgcolor: isDark ? '#1A3A5C' : '#E3F2FD', color: '#1565C0' };
  }
  if (st === 'IN_REVIEW') {
    return { label: statusText(item), bgcolor: isDark ? '#2A1A3D' : '#F3E5F5', color: '#7B1FA2' };
  }
  if (st === 'PENDING') {
    return { label: statusText(item), bgcolor: isDark ? '#4A2A1A' : '#FFF3E0', color: '#E65100' };
  }
  return { label: statusText(item), bgcolor: isDark ? '#2A2C32' : '#ECEFF1', color: isDark ? '#9A9A9A' : '#455A64' };
}

function getPriorityChipProps(priority, isDark) {
  if (priority === 'CRITICAL') {
    return { bgcolor: isDark ? '#4A1A1A' : '#FFEBEE', color: '#C62828' };
  }
  if (priority === 'HIGH') {
    return { bgcolor: isDark ? '#4A2A1A' : '#FFF3E0', color: '#E65100' };
  }
  if (priority === 'MEDIUM') {
    return { bgcolor: isDark ? '#4A3A1A' : '#FFF8E1', color: '#F57F17' };
  }
  if (priority === 'LOW') {
    return { bgcolor: isDark ? '#2A2C32' : '#ECEFF1', color: isDark ? '#9A9A9A' : '#455A64' };
  }
  return { bgcolor: isDark ? '#2A2C32' : '#F5F5F5', color: isDark ? '#9A9A9A' : '#757575' };
}

const DEFAULT_LAYOUT = {
  colWidths: ['20%', '12%', '12%', '10%', '10%', '10%', '11%', '8%', '8%', '9%'],
  headers: [
    'Task',
    'Developer',
    'Status',
    'Priority',
    'Assigned hrs',
    'Worked hrs',
    'Due Date',
    'On Time',
    'Completed',
    '',
  ],
};

/** Manager view: same core columns + due date + completed (no On time). */
const MANAGER_LAYOUT = {
  colWidths: ['17%', '16%', '12%', '11%', '11%', '11%', '14%', '8%', '8%'],
  headers: [
    'Task',
    'Assignees',
    'Status',
    'Priority',
    'Assigned hrs',
    'Worked hrs',
    'Due Date',
    'On-time',
    '',
  ],
};

export default function TaskTable({
  items,
  onComplete,
  onUndo,
  onDelete,
  onRowClick,
  variant = 'default',
  /** e.g. 400 or '42vh' — enables sticky header + internal scroll */
  scrollMaxHeight,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  const managerView = variant === 'manager';
  const hasActions = Boolean(onComplete || onUndo || onDelete);
  const baseLayout = managerView ? MANAGER_LAYOUT : DEFAULT_LAYOUT;
  const layout = hasActions
    ? baseLayout
    : {
        headers: baseLayout.headers.slice(0, -1),
        colWidths: baseLayout.colWidths.slice(0, -1),
      };
  const colSpanEmpty = layout.headers.length;

  const headCellSx = {
    fontSize: '0.7rem',
    fontWeight: 800,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    py: 1.35,
    px: 1.5,
    borderBottom: '1px solid rgba(255,255,255,0.24)',
    backgroundColor: '#C74634',
  };

  const columnCellSx = (_idx) => {
    return {
      bgcolor: 'background.paper',
      borderLeft: `1px solid ${isDark ? '#2A2C32' : '#F0F0F0'}`,
    };
  };

  return (
    <TableContainer
      component={Paper}
      sx={{
        borderRadius: 3,
        border: `1px solid ${isDark ? '#2A2C32' : '#EFEFEF'}`,
        boxShadow: 'none',
        mb: 1,
        bgcolor: 'background.paper',
        ...(scrollMaxHeight != null ? { maxHeight: scrollMaxHeight, overflow: 'auto' } : {}),
      }}
    >
      <Table stickyHeader={scrollMaxHeight != null} size="small" sx={{ tableLayout: 'fixed' }}>
        <colgroup>
          {layout.colWidths.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
        <TableHead>
          <TableRow>
            {layout.headers.map((h, i) => (
              <TableCell key={i} sx={headCellSx}>
                {h}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {items.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={colSpanEmpty}
                sx={{ textAlign: 'center', py: 4, color: isDark ? '#5A5A5A' : '#CCC', fontSize: '0.85rem' }}
              >
                No tasks
              </TableCell>
            </TableRow>
          )}
          {items.map((item) => {
            const statusChip = taskStatusChipProps(item, isDark);
            const priorityChip = getPriorityChipProps(item.priority, isDark);
            const clickable = typeof onRowClick === 'function';
            const completed = isCompletedStatus(item);
            return (
              <TableRow
                key={item.id}
                hover
                title={clickable ? 'Click to view details' : undefined}
                onClick={clickable ? () => onRowClick(item) : undefined}
                sx={{
                  '&:last-child td': { border: 0 },
                  '&:nth-of-type(odd)': { bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(248, 251, 255, 0.6)' },
                  '&:hover': { bgcolor: clickable ? (isDark ? 'rgba(199, 70, 52, 0.12)' : 'rgba(199, 70, 52, 0.06)') : undefined },
                  ...(clickable ? { cursor: 'pointer' } : {}),
                }}
              >
                <TableCell
                  sx={{
                    ...columnCellSx(0),
                    fontWeight: 500,
                    fontSize: '0.88rem',
                    px: 1.5,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    textDecoration: completed ? 'line-through' : 'none',
                    color: completed ? (isDark ? '#5A5A5A' : '#90A4AE') : 'text.primary',
                  }}
                >
                  {item.description}
                </TableCell>
                <TableCell sx={{ px: 1.5, ...columnCellSx(1) }}>
                  <DevelopersCell
                    developers={item.developers}
                    developer={item.developer}
                    assigneeProgress={item.assigneeProgress}
                    managerView={managerView}
                    isDark={isDark}
                  />
                </TableCell>
                <TableCell sx={{ px: 1.5, ...columnCellSx(2) }}>
                  <Chip
                    label={statusChip.label}
                    size="small"
                    sx={{
                      bgcolor: statusChip.bgcolor,
                      color: statusChip.color,
                      fontWeight: 700,
                      fontSize: '0.7rem',
                      height: 20,
                    }}
                  />
                </TableCell>
                <TableCell sx={{ px: 1.5, ...columnCellSx(3) }}>
                  <Chip
                    label={String(item.priority || '—').replace(/_/g, ' ')}
                    size="small"
                    sx={{
                      bgcolor: priorityChip.bgcolor,
                      color: priorityChip.color,
                      fontWeight: 700,
                      fontSize: '0.7rem',
                      height: 20,
                    }}
                  />
                </TableCell>
                <TableCell sx={{ px: 1.5, fontSize: '0.85rem', color: isDark ? '#9A9A9A' : '#666', ...columnCellSx(4) }}>
                  {item.assignedHours != null ? `${item.assignedHours}h` : '—'}
                </TableCell>
                <TableCell sx={{ px: 1.5, fontSize: '0.85rem', color: isDark ? '#9A9A9A' : '#666', ...columnCellSx(5) }}>
                  {item.actualHours != null && Number(item.actualHours) > 0
                    ? `${item.actualHours}h`
                    : '—'}
                </TableCell>
                {managerView && (
                  <>
                    <TableCell
                      sx={{ px: 1.5, fontSize: '0.85rem', color: isDark ? '#9A9A9A' : '#666', ...columnCellSx(6) }}
                    >
                      {fmtDate(item.dueDate)}
                    </TableCell>
                    <TableCell sx={{ px: 1.5, ...columnCellSx(7) }}>
                      <Chip
                        label={completionOnTimeDisplay(item)}
                        size="small"
                        sx={{
                          bgcolor: completionOnTimeDisplay(item) === 'Yes'
                            ? (isDark ? '#1A4A2A' : '#E8F5E9')
                            : completionOnTimeDisplay(item) === 'No'
                              ? (isDark ? '#4A1A1A' : '#FFEBEE')
                              : (isDark ? '#2A2C32' : '#F5F5F5'),
                          color: completionOnTimeDisplay(item) === 'Yes'
                            ? '#2E7D32'
                            : completionOnTimeDisplay(item) === 'No'
                              ? '#C62828'
                              : (isDark ? '#9A9A9A' : '#757575'),
                          fontWeight: 700,
                          fontSize: '0.72rem',
                          height: 22,
                        }}
                      />
                    </TableCell>
                  </>
                )}
                {!managerView && (
                  <>
                    <TableCell
                      sx={{ px: 1.5, fontSize: '0.85rem', color: isDark ? '#9A9A9A' : '#666', ...columnCellSx(6) }}
                    >
                      {fmtDate(item.dueDate)}
                    </TableCell>
                    <TableCell sx={{ px: 1.5, ...columnCellSx(7) }}>
                      <OnTimeChip item={item} isDark={isDark} />
                    </TableCell>
                    <TableCell sx={{ px: 1.5, ...columnCellSx(8) }}>
                      <Chip
                        label={completionOnTimeDisplay(item)}
                        size="small"
                        sx={{
                          bgcolor: completionOnTimeDisplay(item) === 'Yes'
                            ? (isDark ? '#1A4A2A' : '#E8F5E9')
                            : completionOnTimeDisplay(item) === 'No'
                              ? (isDark ? '#4A1A1A' : '#FFEBEE')
                              : (isDark ? '#2A2C32' : '#F5F5F5'),
                          color: completionOnTimeDisplay(item) === 'Yes'
                            ? '#2E7D32'
                            : completionOnTimeDisplay(item) === 'No'
                              ? '#C62828'
                              : (isDark ? '#9A9A9A' : '#757575'),
                          fontWeight: 700,
                          fontSize: '0.72rem',
                          height: 22,
                        }}
                      />
                    </TableCell>
                  </>
                )}
                {hasActions ? (
                  <TableCell
                    sx={{ px: 1, whiteSpace: 'nowrap', ...columnCellSx(managerView ? 8 : 9) }}
                    align="right"
                  >
                    {onComplete && !item.done && (
                      <Button
                        variant="text"
                        size="small"
                        sx={{
                          color: '#E53935',
                          fontWeight: 700,
                          textTransform: 'none',
                          minWidth: 0,
                          px: 1,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onComplete(item.id);
                        }}
                      >
                        ✓
                      </Button>
                    )}
                    {onUndo && item.done && (
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUndo(item.id);
                        }}
                        color="primary"
                      >
                        <UndoIcon fontSize="small" />
                      </IconButton>
                    )}
                    {onDelete && item.done && (
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(item.id);
                        }}
                        sx={{ color: '#FF5252' }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                ) : null}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}