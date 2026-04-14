import React, { useMemo, useState } from 'react';
import { Clock } from 'lucide-react';
import { Menu, MenuItem } from '@mui/material';
import './KanbanBoard.css';

const COLUMN_DEFS = [
  { id: 'todo',       name: 'To Do',       className: 'kanban-col-todo' },
  { id: 'inProgress', name: 'In Progress', className: 'kanban-col-progress' },
  { id: 'review',     name: 'In Review',   className: 'kanban-col-review' },
  { id: 'done',       name: 'Done',        className: 'kanban-col-done' },
];

const STATUS_OPTIONS = [
  { value: 'TODO',        label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'IN_REVIEW',   label: 'In Review' },
  { value: 'PENDING',     label: 'Pending' },
  { value: 'DONE',        label: 'Done' },
];

const STATUS_PILL_STYLE = {
  'TODO':        { bg: '#F5F5F5',  color: '#616161' },
  'IN_PROGRESS': { bg: '#E3F2FD',  color: '#1565C0' },
  'IN_REVIEW':   { bg: '#F3E5F5',  color: '#7B1FA2' },
  'DONE':        { bg: '#E8F5E9',  color: '#2E7D32' },
  'PENDING':     { bg: '#FFF3E0',  color: '#E65100' },
};

const CLASSIFICATION_PILL_STYLE = {
  FEATURE: { bg: '#E8F5E9', color: '#2E7D32', label: 'Feature' },
  BUG: { bg: '#FFEBEE', color: '#C62828', label: 'Bug' },
  TASK: { bg: '#E3F2FD', color: '#1565C0', label: 'Task' },
  USER_STORY: { bg: '#F3E5F5', color: '#7B1FA2', label: 'User Story' },
};

const PRIORITY_PILL_STYLE = {
  LOW: { bg: '#ECEFF1', color: '#546E7A', label: 'Low' },
  MEDIUM: { bg: '#FFF8E1', color: '#F57F17', label: 'Medium' },
  HIGH: { bg: '#FFF3E0', color: '#EF6C00', label: 'High' },
  CRITICAL: { bg: '#FFEBEE', color: '#C62828', label: 'Critical' },
};

function normalizeClassification(value) {
  if (!value) return 'TASK';
  const normalized = String(value).trim().toUpperCase().replace(/\s+/g, '_');
  if (normalized === 'ATASK') return 'TASK';
  if (CLASSIFICATION_PILL_STYLE[normalized]) return normalized;
  return 'TASK';
}

function normalizePriority(value) {
  if (!value) return 'MEDIUM';
  const normalized = String(value).trim().toUpperCase();
  if (PRIORITY_PILL_STYLE[normalized]) return normalized;
  return 'MEDIUM';
}

function priorityRank(value) {
  const key = normalizePriority(value);
  const rankMap = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  return rankMap[key] ?? 0;
}

function initialsFromLabel(label) {
  if (!label || label === 'Unassigned') return '?';
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function bucketForItem(item) {
  if (item.done || item.rawStatus === 'DONE') return 'done';
  if (item.rawStatus === 'IN_PROGRESS' || item.status === 'in_progress') return 'inProgress';
  if (item.rawStatus === 'IN_REVIEW' || item.status === 'in_review' || item.status === 'review') return 'review';
  return 'todo';
}

function TaskCard({ item, isDone, onStatusChange }) {
  const [anchorEl, setAnchorEl] = useState(null);

  const hours = item.actualHours != null && item.actualHours !== ''
    ? `${item.actualHours}h` : '—';

  const rawStatus = item.rawStatus || (isDone ? 'DONE' : 'TODO');
  const pillStyle = STATUS_PILL_STYLE[rawStatus] || STATUS_PILL_STYLE['TODO'];
  const pillLabel = STATUS_OPTIONS.find(s => s.value === rawStatus)?.label || rawStatus;
  const classificationKey = normalizeClassification(item.classification || item._raw?.classification);
  const classificationStyle = CLASSIFICATION_PILL_STYLE[classificationKey];
  const priorityKey = normalizePriority(item.priority || item._raw?.priority);
  const priorityStyle = PRIORITY_PILL_STYLE[priorityKey];

  const handleChipClick = (e) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  };

  const handleMenuSelect = (newStatus) => {
    setAnchorEl(null);
    if (newStatus !== rawStatus) onStatusChange(item.id, newStatus);
  };

  return (
    <div
      className={`kanban-task-card kanban-task-card--p-${priorityKey.toLowerCase()}${isDone ? ' kanban-task-card--done' : ''}`}
      onClick={(e) => setAnchorEl(e.currentTarget)}
      style={{ cursor: 'pointer' }}
    >
      <div className="kanban-task-card-top">
        <span className="kanban-task-id">#{item.id}</span>
        <span
          className="kanban-task-status-pill"
          style={{ background: pillStyle.bg, color: pillStyle.color, cursor: 'pointer' }}
          onClick={handleChipClick}
          title="Click to change status"
        >
          {pillLabel} ▾
        </span>
      </div>
      <p className="kanban-task-title">{item.description || '(No description)'}</p>
      {item.details ? <p className="kanban-task-subtitle">{item.details}</p> : null}
      <div className="kanban-task-classification-row">
        <span
          className="kanban-task-classification-pill"
          style={{ background: classificationStyle.bg, color: classificationStyle.color }}
        >
          {classificationStyle.label}
        </span>
        <span
          className="kanban-task-priority-pill"
          style={{ background: priorityStyle.bg, color: priorityStyle.color }}
        >
          {priorityStyle.label}
        </span>
      </div>
      <div className="kanban-task-footer">
        <div className="kanban-task-meta">
          <div className="kanban-task-hours">
            <Clock style={{ width: 12, height: 12, flexShrink: 0 }} />
            <span>{hours}</span>
          </div>
          {item.developer && (
            <div className="kanban-task-avatar" title={item.developer}>
              {initialsFromLabel(item.developer)}
            </div>
          )}
        </div>
      </div>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        onClick={e => e.stopPropagation()}
      >
        {STATUS_OPTIONS.map(opt => (
          <MenuItem
            key={opt.value}
            selected={opt.value === rawStatus}
            onClick={() => handleMenuSelect(opt.value)}
            sx={{ fontSize: '0.875rem', fontWeight: opt.value === rawStatus ? 700 : 400 }}
          >
            {opt.label}
          </MenuItem>
        ))}
      </Menu>
    </div>
  );
}

export default function KanbanBoard({ items = [], onStatusChange }) {
  const columnsWithTasks = useMemo(() => {
    const buckets = { todo: [], inProgress: [], review: [], done: [] };
    items.forEach((item) => {
      const b = bucketForItem(item);
      buckets[b].push(item);
    });
    Object.values(buckets).forEach((tasks) => {
      tasks.sort((a, b) => priorityRank(b.priority || b._raw?.priority) - priorityRank(a.priority || a._raw?.priority));
    });
    return COLUMN_DEFS.map((col) => ({ ...col, tasks: buckets[col.id] }));
  }, [items]);

  return (
    <div className="kanban-board">
      {columnsWithTasks.map((col) => (
        <div key={col.id} className={`kanban-column ${col.className}`}>
          <div className="kanban-column-header">
            <span className="kanban-column-header-title">{col.name}</span>
            <span className="kanban-column-count">{col.tasks.length}</span>
          </div>
          <div className="kanban-column-body">
            {col.tasks.length === 0 ? (
              <p className="kanban-empty-hint">No tasks</p>
            ) : (
              col.tasks.map((item) => (
                <TaskCard
                  key={item.id}
                  item={item}
                  isDone={col.id === 'done'}
                  onStatusChange={onStatusChange}
                />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}