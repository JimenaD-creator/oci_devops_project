import React, { useState, useEffect } from 'react';
import {
  Box, Button, TextField, FormControl,
  InputLabel, Select, MenuItem, Stack
} from '@mui/material';
import { sprintAPI } from '../services/API';

const CLASSIFICATIONS = ['FEATURE', 'BUG', 'IMPROVEMENT', 'RESEARCH', 'OTHER'];
const STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED'];

function NewItem({ addItem, isInserting }) {
  const [sprints, setSprints] = useState([]);
  const [form, setForm] = useState({
    assignedSprint: '',
    classification: 'FEATURE',
    status: 'PENDING',
    assignedHours: '',
    startDate: '',
    dueDate: '',
  });

  useEffect(() => {
    sprintAPI.getAll().then(setSprints).catch(() => setSprints([]));
}, []);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = () => {
    if (!form.assignedSprint || !form.assignedHours) return;

    const payload = {
      assignedSprint: { id: Number(form.assignedSprint) },
      classification: form.classification,
      status: form.status,
      assignedHours: Number(form.assignedHours),
      startDate: form.startDate ? `${form.startDate}T00:00:00` : null,
      dueDate: form.dueDate ? `${form.dueDate}T00:00:00` : null,
    };

    addItem(payload);

    setForm({
      assignedSprint: '',
      classification: 'FEATURE',
      status: 'PENDING',
      assignedHours: '',
      startDate: '',
      dueDate: '',
    });
  };

  return (
    <Box>
      <Stack direction="row" flexWrap="wrap" gap={2} alignItems="flex-end">
        {/* Sprint */}
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Sprint *</InputLabel>
          <Select
            value={form.assignedSprint}
            onChange={handleChange('assignedSprint')}
            label="Sprint *"
          >
            {sprints.map((s) => (
              <MenuItem key={s.id} value={s.id}>Sprint {s.id}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Classification */}
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Classification</InputLabel>
          <Select
            value={form.classification}
            onChange={handleChange('classification')}
            label="Classification"
          >
            {CLASSIFICATIONS.map((c) => (
              <MenuItem key={c} value={c}>{c}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Status */}
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={form.status}
            onChange={handleChange('status')}
            label="Status"
          >
            {STATUSES.map((s) => (
              <MenuItem key={s} value={s}>{s}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Hours */}
        <TextField
          size="small"
          label="Hours *"
          type="number"
          value={form.assignedHours}
          onChange={handleChange('assignedHours')}
          inputProps={{ min: 1 }}
          sx={{ width: 100 }}
        />

        {/* Start Date */}
        <TextField
          size="small"
          label="Start date"
          type="date"
          value={form.startDate}
          onChange={handleChange('startDate')}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 160 }}
        />

        {/* Due Date */}
        <TextField
          size="small"
          label="Due date"
          type="date"
          value={form.dueDate}
          onChange={handleChange('dueDate')}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 160 }}
        />

        <Button
          variant="contained"
          disabled={isInserting || !form.assignedSprint || !form.assignedHours}
          onClick={handleSubmit}
          sx={{ bgcolor: '#C74634', '&:hover': { bgcolor: '#a3381f' }, height: 40 }}
        >
          {isInserting ? 'Adding…' : 'Add Task'}
        </Button>
      </Stack>
    </Box>
  );
}

export default NewItem;