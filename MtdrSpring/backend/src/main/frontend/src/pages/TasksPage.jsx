import React, { useMemo, useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Typography,
  Paper,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Stack,
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import NewItem from '../components/NewItem';
import KanbanBoard from '../components/tasks/KanbanBoard';
import { SPRINTS_FOR_SELECTOR } from '../components/dashboard/dashboardSprintData';
import {
  matchesStatusFilter,
  itemSprintKey,
  getDeveloperFilterOptions,
  itemMatchesDeveloperFilter,
  matchesDueDateRange,
  FILTER_MENU_ITEM_SX,
} from '../components/dashboard/taskFilters';

const ORACLE_RED = '#C74634';

const UNASSIGNED_SPRINT = '__unassigned__';
const UNASSIGNED_DEV = '__unassigned_dev__';

export default function TasksPage({ items, isLoading, isInserting, toggleDone, deleteItem, addItem }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [developerFilter, setDeveloperFilter] = useState('all');
  const [sprintTaskFilter, setSprintTaskFilter] = useState('all');
  const [dueFrom, setDueFrom] = useState('');
  const [dueTo, setDueTo] = useState('');

  const developerFilterOptions = useMemo(() => getDeveloperFilterOptions(items), [items]);

  const hasUnassignedDeveloper = useMemo(() => items.some((i) => !i.developer), [items]);

  useEffect(() => {
    if (developerFilter === 'all' || developerFilter === UNASSIGNED_DEV) return;
    const allowed = new Set(developerFilterOptions.map((o) => o.value));
    if (!allowed.has(developerFilter)) setDeveloperFilter('all');
  }, [developerFilter, developerFilterOptions]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
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
  }, [items, statusFilter, developerFilter, sprintTaskFilter, dueFrom, dueTo]);

  const pendingCount = useMemo(() => items.filter((i) => !i.done).length, [items]);

  return (
    <Box sx={{ maxWidth: 1200, width: '100%' }}>
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
        <Typography variant="h4" sx={{ fontWeight: 800, color: '#1A1A1A', letterSpacing: '-0.5px' }}>
          Tasks
        </Typography>
        <Typography variant="body2" sx={{ color: '#666', mt: 0.75, fontWeight: 500 }}>
          Manage project tasks: filter, complete, and track work in one place.
        </Typography>
        <Chip
          label={`${pendingCount} pending`}
          size="small"
          sx={{ mt: 1.5, bgcolor: '#FFF3E0', color: '#E65100', fontWeight: 700, fontSize: '0.72rem' }}
        />
      </Paper>

      <Paper sx={{ p: 3, borderRadius: 3, mb: 3, border: '1px solid #EFEFEF', boxShadow: 'none' }}>
        <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 700 }}>
          Agregar nueva tarea
        </Typography>
        <NewItem addItem={addItem} isInserting={isInserting} />
      </Paper>

      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          mb: 2,
          borderRadius: 3,
          border: '1px solid #ECECEC',
          bgcolor: '#FAFAFA',
          boxShadow: 'none',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <FilterListIcon sx={{ fontSize: 22, color: ORACLE_RED }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#1A1A1A', letterSpacing: '-0.02em' }}>
            Filter tasks
          </Typography>
        </Stack>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            alignItems: 'flex-end',
            '& .MuiFormControl-root': { flex: '1 1 160px', minWidth: { xs: '100%', sm: 160 }, maxWidth: { sm: 220 } },
          }}
        >
          <FormControl size="small" fullWidth>
            <InputLabel id="tasks-status-filter-label">Status</InputLabel>
            <Select
              labelId="tasks-status-filter-label"
              id="tasks-status-filter"
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
            <InputLabel id="tasks-developer-filter-label">Developer</InputLabel>
            <Select
              labelId="tasks-developer-filter-label"
              id="tasks-developer-filter"
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
            <InputLabel id="tasks-sprint-filter-label">Sprint</InputLabel>
            <Select
              labelId="tasks-sprint-filter-label"
              id="tasks-sprint-filter"
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
        </Box>
      </Paper>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress sx={{ color: ORACLE_RED }} />
        </Box>
      ) : (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
              <Box sx={{ width: 8, height: 8, bgcolor: ORACLE_RED, borderRadius: '50%' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Kanban board
              </Typography>
              <Chip
                label={filteredItems.length}
                size="small"
                sx={{ ml: 'auto', bgcolor: '#F5F5F5', fontWeight: 700, height: 20, fontSize: '0.7rem' }}
              />
            </Box>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                mb: 3,
                borderRadius: 3,
                border: '1px solid #ECECEC',
                bgcolor: '#FFFFFF',
                overflow: 'hidden',
              }}
            >
              <KanbanBoard items={filteredItems} />
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
