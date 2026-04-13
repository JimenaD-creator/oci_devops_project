import React from 'react';
import { Box } from '@mui/material';
import { Clock, ClipboardList } from 'lucide-react';
import { motion } from 'framer-motion';
import TaskStatusDistributionChart from './TaskStatusDistributionChart';

const ORACLE_RED = '#C74634';

const cardBase = {
  backgroundColor: 'white',
  borderRadius: '12px',
  border: '1px solid #EFEFEF',
  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  padding: '1.25rem 1.35rem',
  overflow: 'hidden',
};

/**
 * KPI cards when exactly one sprint is selected (dashboard).
 * Left: tasks + hours stacked vertically and stretched to match chart height.
 * Right: task status bar chart.
 */
export default function SummaryCards({
  totalHoursDisplay = '0',
  taskStatusDistribution = [],
  taskStatusTotal = 0,
}) {
  const cards = [
    {
      icon: ClipboardList,
      title: 'Total tasks',
      value: String(taskStatusTotal),
      subtitle: 'all tasks assigned to this sprint',
    },
    {
      icon: Clock,
      title: 'Total Hours Worked',
      value: totalHoursDisplay,
      subtitle: 'hours logged this sprint',
    },
  ];

  const styles = {
    card: {
      ...cardBase,
      borderTop: `3px solid ${ORACLE_RED}`,
      display: 'flex',
      alignItems: 'center',
      gap: '1.25rem',
      flex: 1,
      minHeight: 0,
      width: '100%',
    },
    iconWrapper: {
      width: '4rem',
      height: '4rem',
      borderRadius: '1rem',
      backgroundColor: 'rgba(199,70,52,0.1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    content: { flex: 1, minWidth: 0 },
    label: { fontSize: '0.95rem', fontWeight: 700, color: '#555', marginBottom: '0.35rem' },
    value: { fontSize: '2.85rem', fontWeight: 800, color: '#1A1A1A', lineHeight: 1.05, marginBottom: '0.35rem' },
    subtitle: { fontSize: '0.9rem', color: '#616161', fontWeight: 500 },
  };

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 1fr)' },
        gap: 2,
        alignItems: 'stretch',
        mb: 3,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          minHeight: 0,
          height: { md: '100%' },
        }}
      >
        {cards.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.4 }}
            style={{ flex: 1, display: 'flex', minHeight: 0 }}
          >
            <div style={styles.card}>
              <div style={styles.iconWrapper}>
                <card.icon style={{ width: '2rem', height: '2rem', color: ORACLE_RED }} />
              </div>
              <div style={styles.content}>
                <p style={styles.label}>{card.title}</p>
                <p style={styles.value}>{card.value}</p>
                <p style={styles.subtitle}>{card.subtitle}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: { md: '100%' } }}>
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
        >
          <TaskStatusDistributionChart distribution={taskStatusDistribution} total={taskStatusTotal} />
        </motion.div>
      </Box>
    </Box>
  );
}
