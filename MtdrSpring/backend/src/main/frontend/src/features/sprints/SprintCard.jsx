import React from 'react';
import { Box, Typography, Card, CardContent, Chip, LinearProgress } from '@mui/material';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import {
  ORACLE_RED,
  PROGRESS_BAR,
  PROGRESS_BAR_COMPLETE,
  PROGRESS_LABEL,
  PROGRESS_TRACK,
  STATUS_CONFIG,
} from './constants/sprintConstants';
import { formatDate, inferSprintStatus } from './utils/sprintUtils';

export function SprintCard({ sprint, tasks, isSelected, onClick }) {
  const status = inferSprintStatus(sprint, tasks);
  const statusCfg = STATUS_CONFIG[status];
  const sprintTasks = tasks.filter((t) => t.assignedSprint?.id === sprint.id);
  const done = sprintTasks.filter((t) => t.status === 'DONE').length;
  const total = sprintTasks.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : Math.round((sprint.completionRate ?? 0) * 100);
  /** Green bar when every task is done or the sprint is in the “completed” lifecycle state (chip). */
  const progressBarComplete = progress >= 100 || status === 'completed';

  const outlineColor = statusCfg.textColor;
  return (
    <Card
      onClick={onClick}
      sx={{
        borderRadius: 3,
        border: isSelected ? `2px solid ${outlineColor}` : '1px solid #EFEFEF',
        boxShadow: isSelected ? `0 4px 14px ${outlineColor}33` : '0 2px 8px rgba(0,0,0,0.04)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        '&:hover': { boxShadow: '0 4px 16px rgba(0,0,0,0.08)', transform: 'translateY(-1px)' },
        bgcolor: isSelected ? statusCfg.color : 'white',
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
          <Box><Typography sx={{ fontWeight: 800, fontSize: '1.08rem' }}>Sprint {sprint.id}</Typography><Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}><CalendarTodayIcon sx={{ fontSize: 12, color: '#AAA' }} /><Typography variant="caption" sx={{ color: '#999' }}>{formatDate(sprint.startDate)} → {formatDate(sprint.dueDate)}</Typography></Box></Box>
          <Chip label={statusCfg.label} size="small" sx={{ bgcolor: statusCfg.color, color: statusCfg.textColor, fontWeight: 700, fontSize: '0.7rem' }} />
        </Box>
        {total > 0 && (<><Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}><Typography variant="caption" sx={{ color: '#888', fontWeight: 600 }}>Progress</Typography><Typography variant="caption" sx={{ fontWeight: 800, color: progressBarComplete ? PROGRESS_BAR_COMPLETE : PROGRESS_LABEL }}>{progress}%</Typography></Box><LinearProgress variant="determinate" value={progress} sx={{ height: 6, borderRadius: 3, bgcolor: PROGRESS_TRACK, mb: 2, '& .MuiLinearProgress-bar': { bgcolor: progressBarComplete ? PROGRESS_BAR_COMPLETE : PROGRESS_BAR, borderRadius: 3 } }} /></>)}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><Box sx={{ display: 'flex', gap: 1.5 }}><CheckCircleIcon sx={{ fontSize: 14, color: '#4CAF50' }} /><Typography variant="caption" sx={{ fontWeight: 600, color: '#555' }}>{done}</Typography><RadioButtonUncheckedIcon sx={{ fontSize: 14, color: ORACLE_RED }} /><Typography variant="caption" sx={{ fontWeight: 600, color: '#555' }}>{total - done}</Typography></Box><Typography variant="caption" sx={{ color: '#AAA', fontWeight: 600 }}>{total} tasks</Typography></Box>
      </CardContent>
    </Card>
  );
}
