import React from "react";
import {
  Table, TableBody, TableCell, TableContainer, TableRow,
  Paper, Chip, IconButton, Button, TableHead, Typography
} from '@mui/material';
import { DeleteIcon } from "lucide-react";
import { UndoIcon } from "lucide-react";
import { DEVELOPER_DISPLAY_NAME } from './dashboardSprintData';

export const DEV_COLORS = {
  developer1: { bg: '#E3F2FD', color: '#1565C0', label: 'Dev 1' },
  developer2: { bg: '#E8F5E9', color: '#2E7D32', label: 'Dev 2' },
  developer3: { bg: '#FFF3E0', color: '#E65100', label: 'Dev 3' },
  developer4: { bg: '#FCE4EC', color: '#880E4F', label: 'Dev 4' },
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

function OnTimeChip({item}) {
    if(!item.done || !item.dueDate || item.actualHours === null) {
      return(<Typography variant = "caption" sx={{color: '#BBB'}}></Typography>);
    }
    const ok = item.actualHours <= (item.estimatedHours ?? Infinity);
    return (
    <Chip
      label={ok ? 'Yes' : 'No'}
      size="small"
      sx={{
        bgcolor: ok ? '#E8F5E9' : '#FFEBEE',
        color: ok ? '#2E7D32' : '#C62828',
        fontWeight: 700, fontSize: '0.7rem', height: 20,
      }}
    />
  );

}

function DevChip({ developer }) {
  const d = DEV_COLORS[developer];
  const label = getDeveloperLabel(developer);
  const style = d
    ? { bgcolor: d.bg, color: d.color }
    : { bgcolor: '#F5F5F5', color: '#555' };
  if (!developer) return <Typography variant="caption" sx={{ color: '#BBB' }}>—</Typography>;
  return (
    <Chip
      label={label}
      size="small"
      sx={{ ...style, fontWeight: 700, fontSize: '0.7rem', height: 22 }}
    />
  );
}

function fmtDate(d){
    if(!d) return('-');
    return String(d).slice(0,10);
}

function completedDateDisplay(item) {
  if (!item.done) return '—';
  const raw = item.completedAt ?? item.completed_at;
  if (!raw) return '—';
  return fmtDate(raw);
}

function taskStatusChipProps(item) {
  if (item.done) {
    return { label: 'Done', bgcolor: '#E8F5E9', color: '#2E7D32' };
  }
  if (item.status === 'in_progress' || item.inProgress === true) {
    return { label: 'In progress', bgcolor: '#E3F2FD', color: '#1565C0' };
  }
  return { label: 'Pending', bgcolor: '#FFF3E0', color: '#E65100' };
}


const DEFAULT_LAYOUT = {
  colWidths: ['24%', '11%', '10%', '9%', '9%', '8%', '9%', '11%'],
  headers: ['Task', 'Developer', 'Status', 'Worked hrs', 'Due Date', 'On Time', 'Completed', ''],
};

/** Manager view: same core columns + due date + completed (no On time). */
const MANAGER_LAYOUT = {
  colWidths: ['24%', '12%', '11%', '10%', '10%', '12%', '13%'],
  headers: ['Task', 'Developer', 'Status', 'Worked hrs', 'Due Date', 'Completed', ''],
};

export default function TaskTable({
  items,
  onComplete,
  onUndo,
  onDelete,
  variant = 'default',
  /** e.g. 400 or '42vh' — enables sticky header + internal scroll */
  scrollMaxHeight,
}) {
  const managerView = variant === 'manager';
  const layout = managerView ? MANAGER_LAYOUT : DEFAULT_LAYOUT;
  const colSpanEmpty = managerView ? 7 : 8;

  const headCellSx = {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: '#AAA',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    py: 1.2,
    px: 1.5,
    borderBottom: '1px solid #F0F0F0',
    backgroundColor: '#FAFAFA',
  };

  return (
    <TableContainer
      component={Paper}
      sx={{
        borderRadius: 3,
        border: '1px solid #EFEFEF',
        boxShadow: 'none',
        mb: 1,
        ...(scrollMaxHeight != null
          ? { maxHeight: scrollMaxHeight, overflow: 'auto' }
          : {}),
      }}
    >
      <Table
        stickyHeader={scrollMaxHeight != null}
        size="small"
        sx={{ tableLayout: 'fixed' }}
      >
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
                sx={{ textAlign: 'center', py: 4, color: '#CCC', fontSize: '0.85rem' }}
              >
                No tasks
              </TableCell>
            </TableRow>
          )}
          {items.map((item) => {
            const statusChip = taskStatusChipProps(item);
            return (
              <TableRow key={item.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                <TableCell
                  sx={{
                    fontWeight: 500,
                    fontSize: '0.88rem',
                    px: 1.5,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    textDecoration: item.done ? 'line-through' : 'none',
                    color: item.done ? '#BBB' : '#1A1A1A',
                  }}
                >
                  {item.description}
                </TableCell>
                <TableCell sx={{ px: 1.5 }}>
                  <DevChip developer={item.developer} />
                </TableCell>
                <TableCell sx={{ px: 1.5 }}>
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
                <TableCell sx={{ px: 1.5, fontSize: '0.85rem', color: '#666' }}>
                  {item.actualHours != null ? `${item.actualHours}h` : '—'}
                </TableCell>
                {managerView && (
                  <>
                    <TableCell sx={{ px: 1.5, fontSize: '0.85rem', color: '#666' }}>
                      {fmtDate(item.dueDate)}
                    </TableCell>
                    <TableCell sx={{ px: 1.5, fontSize: '0.85rem', color: '#666' }}>
                      {completedDateDisplay(item)}
                    </TableCell>
                  </>
                )}
                {!managerView && (
                  <>
                    <TableCell sx={{ px: 1.5, fontSize: '0.85rem', color: '#666' }}>
                      {fmtDate(item.dueDate)}
                    </TableCell>
                    <TableCell sx={{ px: 1.5 }}>
                      <OnTimeChip item={item} />
                    </TableCell>
                    <TableCell sx={{ px: 1.5, fontSize: '0.85rem', color: '#666' }}>
                      {completedDateDisplay(item)}
                    </TableCell>
                  </>
                )}
                <TableCell sx={{ px: 1, whiteSpace: 'nowrap' }} align="right">
                  {onComplete && !item.done && (
                    <Button
                      variant="text"
                      size="small"
                      sx={{ color: '#E53935', fontWeight: 700, textTransform: 'none', minWidth: 0, px: 1 }}
                      onClick={() => onComplete(item.id)}
                    >
                      ✓
                    </Button>
                  )}
                  {onUndo && item.done && (
                    <IconButton size="small" onClick={() => onUndo(item.id)} color="primary">
                      <UndoIcon fontSize="small" />
                    </IconButton>
                  )}
                  {onDelete && item.done && (
                    <IconButton size="small" onClick={() => onDelete(item.id)} sx={{ color: '#FF5252' }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
