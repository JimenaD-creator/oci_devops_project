import React, { useMemo, useState, useEffect } from 'react';
import {
  Box, Grid, Card, CardContent, Chip, Typography,
  LinearProgress,
  Paper, IconButton, Button, Badge,
  FormGroup, FormControlLabel, Checkbox,
  CircularProgress,
  FormControl, InputLabel, Select, MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import NotificationsIcon from '@mui/icons-material/Notifications';
import GroupIcon from '@mui/icons-material/Group';
import FilterListIcon from '@mui/icons-material/FilterList';
import SummaryCards from './SummaryCards';
import SprintComparisonCharts from './SprintComparisonCharts';
import DeveloperWorkloadCharts from '../analytics/DeveloperWorkloadCharts';
import DeveloperTable from '../analytics/DeveloperTable';
import TaskTable from './TaskTable';
import {
  matchesStatusFilter,
  itemSprintKey,
  getDeveloperFilterOptions,
  itemMatchesDeveloperFilter,
  matchesDueDateRange,
  FILTER_MENU_ITEM_SX,
} from './taskFilters';
import {
  SPRINTS_FOR_SELECTOR,
  DEFAULT_SELECTED_SPRINT_IDS,
  getSprintsByIds,
} from './dashboardSprintData';

const ORACLE_RED = '#C74634';

const UNASSIGNED_SPRINT = '__unassigned__';
const UNASSIGNED_DEV = '__unassigned_dev__';

export default function DashboardPage({ items, isLoading, toggleDone, deleteItem, onNavigateToTasks }) {
  const [selectedSprintIds, setSelectedSprintIds] = useState(DEFAULT_SELECTED_SPRINT_IDS);
  const [statusFilter, setStatusFilter] = useState('all');
  const [developerFilter, setDeveloperFilter] = useState('all');
  const [sprintTaskFilter, setSprintTaskFilter] = useState('all');
  const [dueFrom, setDueFrom] = useState('');
  const [dueTo, setDueTo] = useState('');

  const selectedSprints = useMemo(() => getSprintsByIds(selectedSprintIds), [selectedSprintIds]);
  const compareMode = selectedSprints.length > 1;
  const primarySprint = selectedSprints[0];

  const teamDeveloperCount = useMemo(
    () => new Set(selectedSprints.flatMap((s) => s.developers.map((d) => d.name))).size,
    [selectedSprints]
  );

  const developerFilterOptions = useMemo(() => getDeveloperFilterOptions(items), [items]);

  const hasUnassignedDeveloper = useMemo(() => items.some((i) => !i.developer), [items]);

  useEffect(() => {
    if (developerFilter === 'all' || developerFilter === UNASSIGNED_DEV) return;
    const allowed = new Set(developerFilterOptions.map((o) => o.value));
    if (!allowed.has(developerFilter)) setDeveloperFilter('all');
  }, [developerFilter, developerFilterOptions]);

  const dashboardTaskRows = useMemo(() => {
    const filtered = items.filter((item) => {
      if (!matchesStatusFilter(item, statusFilter)) return false;

      if (!itemMatchesDeveloperFilter(item, developerFilter, UNASSIGNED_DEV)) return false;

      if (sprintTaskFilter !== 'all') {
        const sid = itemSprintKey(item);
        if (sprintTaskFilter === UNASSIGNED_SPRINT) {
          if (sid != null) return false;
        } else if (sid !== sprintTaskFilter) {
          return false;
        }
      }

      if (!matchesDueDateRange(item, dueFrom, dueTo)) return false;
      return true;
    });
    return [...filtered].sort((a, b) => Number(a.done) - Number(b.done));
  }, [items, statusFilter, developerFilter, sprintTaskFilter, dueFrom, dueTo]);

  const heroProgress = useMemo(() => {
    if (!primarySprint) return 0;
    if (compareMode) {
      const avg = selectedSprints.reduce((a, s) => a + s.kpis.completionRate, 0) / selectedSprints.length;
      return Math.round(avg);
    }
    if (!primarySprint.totalTasks) return 0;
    return Math.round((primarySprint.totalCompleted / primarySprint.totalTasks) * 100);
  }, [primarySprint, compareMode, selectedSprints]);

  const toggleSprint = (id, checked) => {
    setSelectedSprintIds((prev) => {
      let next;
      if (checked) {
        next = [...new Set([...prev, id])];
      } else {
        if (prev.length <= 1) return prev;
        next = prev.filter((x) => x !== id);
      }
      return SPRINTS_FOR_SELECTOR.map((s) => s.id).filter((sid) => next.includes(sid));
    });
  };

  const dashboardSubtitle = compareMode
    ? selectedSprints.map((s) => `${s.name} · ${s.dateRangeEn || s.dateRange}`).join('  |  ')
    : `${primarySprint?.name ?? ''} · ${primarySprint?.dateRangeEn ?? primarySprint?.dateRange ?? ''}`;

  return (
    <Box sx={{ maxWidth: 1200, width: '100%' }}>
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          mb: 2,
          borderRadius: 3,
          border: '1px solid #ECECEC',
          bgcolor: '#FFFFFF',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ flex: '1 1 280px', minWidth: 0 }}>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#1A1A1A', letterSpacing: '-0.5px' }}>
              Dashboard - Mobile App Development
            </Typography>
            <Typography variant="body2" sx={{ color: '#666', mt: 0.75, fontWeight: 500 }}>
              {dashboardSubtitle}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexShrink: 0 }}>
            <Button
              startIcon={<RefreshIcon />}
              variant="outlined"
              size="small"
              sx={{ borderColor: '#DDD', color: '#555', textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
            >
              Refresh
            </Button>
            <IconButton sx={{ bgcolor: '#F5F5F5', border: '1px solid #EEE', borderRadius: 2 }} aria-label="Notifications">
              <Badge badgeContent={3} color="error">
                <NotificationsIcon sx={{ fontSize: 20 }} />
              </Badge>
            </IconButton>
          </Box>
        </Box>
      </Paper>

      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          mb: 3,
          borderRadius: 3,
          border: '1px solid #ECECEC',
          bgcolor: '#FFFFFF',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1A1A1A', mb: 1.5 }}>
          Select Sprints:
        </Typography>
        <FormGroup row sx={{ flexWrap: 'wrap', gap: { xs: 0.5, sm: 1 }, columnGap: 2.5, alignItems: 'flex-start' }}>
          {SPRINTS_FOR_SELECTOR.map((sp) => (
            <FormControlLabel
              key={sp.id}
              control={
                <Checkbox
                  size="small"
                  checked={selectedSprintIds.includes(sp.id)}
                  onChange={(e) => toggleSprint(sp.id, e.target.checked)}
                  sx={{
                    color: '#BDBDBD',
                    '&.Mui-checked': { color: sp.accentColor },
                  }}
                />
              }
              label={
                <Typography component="span" variant="body2" sx={{ fontWeight: 600, color: '#333' }}>
                  {sp.name}
                </Typography>
              }
              sx={{ m: 0, mr: 1 }}
            />
          ))}
        </FormGroup>
      </Paper>

      {!compareMode ? (
        <SummaryCards
          completedTasksCount={primarySprint?.totalCompleted ?? 0}
          totalHoursDisplay={primarySprint != null ? Number(primarySprint.totalHours).toFixed(1) : '0'}
          pendingTasksCount={
            primarySprint != null
              ? Math.max(0, (primarySprint.totalTasks ?? 0) - (primarySprint.totalCompleted ?? 0))
              : 0
          }
        />
      ) : (
        <SprintComparisonCharts selectedSprints={selectedSprints} />
      )}

      <Card sx={{ borderRadius: 3, border: '1px solid #EFEFEF', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 1.5,
              mb: 2,
              rowGap: 1,
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#1A1A1A' }}>
              Mobile App Development
            </Typography>
            <Typography sx={{ color: '#BDBDBD', fontWeight: 300, fontSize: '1.25rem', lineHeight: 1 }}>
              |
            </Typography>
            <Chip
              label="Active"
              size="small"
              sx={{
                bgcolor: '#E8F5E9',
                color: '#2E7D32',
                fontWeight: 700,
                fontSize: '0.72rem',
              }}
            />
            <Typography sx={{ color: '#BDBDBD', fontWeight: 300, fontSize: '1.25rem', lineHeight: 1 }}>
              |
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <GroupIcon sx={{ fontSize: 18, color: '#757575' }} />
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#333' }}>
                {teamDeveloperCount} developers
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#555' }}>
              Progress
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 800, color: ORACLE_RED }}>
              {heroProgress}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={Math.min(100, heroProgress)}
            sx={{
              height: 10,
              borderRadius: 5,
              bgcolor: '#F0F0F0',
              '& .MuiLinearProgress-bar': { bgcolor: ORACLE_RED, borderRadius: 5 },
            }}
          />
        </CardContent>
      </Card>

      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          mb: 3,
          borderRadius: 3,
          border: '1px solid #ECECEC',
          bgcolor: '#FAFAFA',
          boxShadow: 'none',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
          <FilterListIcon sx={{ fontSize: 22, color: ORACLE_RED }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#1A1A1A', letterSpacing: '-0.02em' }}>
              Tasks at a glance
            </Typography>
            <Typography variant="body2" sx={{ color: '#666', mt: 0.25, fontWeight: 500 }}>
              Filter like in Tasks; table shows task, developer, status, and worked hours. Scroll inside the table when there are many rows.
            </Typography>
          </Box>
        </Stack>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            gap: 2,
            mb: 2,
            '& .MuiFormControl-root': {
              flex: '1 1 160px',
              minWidth: { xs: '100%', sm: 160 },
              maxWidth: { sm: 220 },
            },
          }}
        >
          <FormControl size="small" fullWidth>
            <InputLabel id="dashboard-status-filter-label">Status</InputLabel>
            <Select
              labelId="dashboard-status-filter-label"
              id="dashboard-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              label="Status"
            >
              <MenuItem value="all" sx={FILTER_MENU_ITEM_SX}>All statuses</MenuItem>
              <MenuItem value="pending" sx={FILTER_MENU_ITEM_SX}>Pending</MenuItem>
              <MenuItem value="in_progress" sx={FILTER_MENU_ITEM_SX}>In progress</MenuItem>
              <MenuItem value="completed" sx={FILTER_MENU_ITEM_SX}>Completed</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth>
            <InputLabel id="dashboard-developer-filter-label">Developer</InputLabel>
            <Select
              labelId="dashboard-developer-filter-label"
              id="dashboard-developer-filter"
              value={developerFilter}
              onChange={(e) => setDeveloperFilter(e.target.value)}
              label="Developer"
            >
              <MenuItem value="all" sx={FILTER_MENU_ITEM_SX}>All developers</MenuItem>
              {hasUnassignedDeveloper && (
                <MenuItem value={UNASSIGNED_DEV} sx={FILTER_MENU_ITEM_SX}>Unassigned</MenuItem>
              )}
              {developerFilterOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value} sx={FILTER_MENU_ITEM_SX}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth>
            <InputLabel id="dashboard-sprint-filter-label">Sprint</InputLabel>
            <Select
              labelId="dashboard-sprint-filter-label"
              id="dashboard-sprint-filter"
              value={sprintTaskFilter}
              onChange={(e) => setSprintTaskFilter(e.target.value)}
              label="Sprint"
            >
              <MenuItem value="all" sx={FILTER_MENU_ITEM_SX}>All sprints</MenuItem>
              <MenuItem value={UNASSIGNED_SPRINT} sx={FILTER_MENU_ITEM_SX}>No sprint</MenuItem>
              {SPRINTS_FOR_SELECTOR.map((sp) => (
                <MenuItem key={sp.id} value={String(sp.id)} sx={FILTER_MENU_ITEM_SX}>
                  {sp.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            size="small"
            type="date"
            label="Due from"
            value={dueFrom}
            onChange={(e) => setDueFrom(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
            sx={{ flex: '1 1 160px !important', maxWidth: { sm: 220 } }}
          />
          <TextField
            size="small"
            type="date"
            label="Due to"
            value={dueTo}
            onChange={(e) => setDueTo(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
            sx={{ flex: '1 1 160px !important', maxWidth: { sm: 220 } }}
          />

          <Chip
            label={`${dashboardTaskRows.length} shown`}
            size="small"
            sx={{ bgcolor: '#F0F0F0', fontWeight: 700, height: 24, fontSize: '0.72rem' }}
          />
          {onNavigateToTasks && (
            <Button
              variant="contained"
              onClick={onNavigateToTasks}
              sx={{
                ml: { xs: 0, md: 'auto' },
                bgcolor: ORACLE_RED,
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: 2,
                px: 2.5,
                boxShadow: 'none',
                '&:hover': { bgcolor: '#A83B2D', boxShadow: 'none' },
              }}
            >
              Add task
            </Button>
          )}
        </Box>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress sx={{ color: ORACLE_RED }} size={36} />
          </Box>
        ) : (
          <TaskTable
            variant="manager"
            scrollMaxHeight="min(45vh, 420px)"
            items={dashboardTaskRows}
            onComplete={(id) => toggleDone(null, id, '', true)}
            onUndo={(id) => toggleDone(null, id, '', false)}
            onDelete={deleteItem}
          />
        )}
      </Paper>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <DeveloperWorkloadCharts
            comparisonMode={compareMode}
            selectedSprints={selectedSprints}
            items={items}
            which="completed"
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <DeveloperWorkloadCharts
            comparisonMode={compareMode}
            selectedSprints={selectedSprints}
            items={items}
            which="hours"
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <DeveloperWorkloadCharts
            comparisonMode={compareMode}
            selectedSprints={selectedSprints}
            items={items}
            which="workload"
          />
        </Grid>
      </Grid>

      <DeveloperTable selectedSprints={selectedSprints} compareMode={compareMode} />
    </Box>
  );
}
