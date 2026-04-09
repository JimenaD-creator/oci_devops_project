import React, { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { getDeveloperLabel } from '../dashboard/TaskTable';
import './KanbanBoard.css';

const COLUMN_DEFS = [
  { id: 'todo', name: 'To Do', className: 'kanban-col-todo' },
  { id: 'inProgress', name: 'In Progress', className: 'kanban-col-progress' },
  { id: 'review', name: 'In Review', className: 'kanban-col-review' },
  { id: 'done', name: 'Done', className: 'kanban-col-done' },
];

function initialsFromLabel(label) {
  if (!label || label === 'Unassigned') return '?';
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function bucketForItem(item) {
  if (item.done) return 'done';
  if (item.status === 'in_progress' || item.inProgress === true) return 'inProgress';
  if (item.status === 'in_review' || item.status === 'review') return 'review';
  return 'todo';
}

function TaskCard({ item, isDone }) {
  const assigneeLabel = getDeveloperLabel(item.developer);
  const hours =
    item.actualHours != null && item.actualHours !== ''
      ? `${item.actualHours}h`
      : '—';

  return (
    <div className={`kanban-task-card${isDone ? ' kanban-task-card--done' : ''}`}>
      <div className="kanban-task-card-top">
        <span className="kanban-task-id">#{item.id}</span>
        <span className="kanban-task-status-pill">{isDone ? 'Done' : 'Open'}</span>
      </div>
      <p className="kanban-task-title">{item.description || '(No description)'}</p>
      <div className="kanban-task-footer">
        <div className="kanban-task-meta">
          <div className="kanban-task-hours">
            <Clock style={{ width: 12, height: 12, flexShrink: 0 }} />
            <span>{hours}</span>
          </div>
          <div className="kanban-task-avatar" title={assigneeLabel}>
            {initialsFromLabel(assigneeLabel)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function KanbanBoard({ items = [] }) {
  const columnsWithTasks = useMemo(() => {
    const buckets = { todo: [], inProgress: [], review: [], done: [] };
    items.forEach((item) => {
      const b = bucketForItem(item);
      buckets[b].push(item);
    });
    return COLUMN_DEFS.map((col) => ({
      ...col,
      tasks: buckets[col.id],
    }));
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
                <TaskCard key={item.id} item={item} isDone={col.id === 'done'} />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
