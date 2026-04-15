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
  padding: '1.05rem 1.2rem',
  overflow: 'hidden',
};

/**
 * KPI cards + task status chart in one row (single-sprint dashboard).
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
      justifyContent: 'flex-start',
      gap: '0.95rem',
      width: '100%',
      minHeight: '100%',
      boxSizing: 'border-box',
    },
    iconWrapper: {
      width: '2.85rem',
      height: '2.85rem',
      borderRadius: '10px',
      backgroundColor: 'rgba(199,70,52,0.1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    content: { flex: 1, minWidth: 0 },
    label: { fontSize: '0.75rem', fontWeight: 700, color: '#555', marginBottom: '0.28rem', textTransform: 'uppercase', letterSpacing: '0.04em' },
    value: { fontSize: '1.95rem', fontWeight: 800, color: '#1A1A1A', lineHeight: 1.08, marginBottom: '0.2rem' },
    subtitle: { fontSize: '0.8rem', color: '#888', fontWeight: 500, lineHeight: 1.35 },
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'nowrap',
        alignItems: 'stretch',
        justifyContent: 'flex-start',
        gap: 1.25,
        width: '100%',
        minWidth: 0,
        mb: 2.5,
      }}
    >
      {cards.map((card, i) => (
        <Box
          key={card.title}
          component={motion.div}
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, duration: 0.35 }}
          sx={{
            flex: '1 1 0',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={styles.card}>
            <div style={styles.iconWrapper}>
              <card.icon style={{ width: '1.4rem', height: '1.4rem', color: ORACLE_RED }} />
            </div>
            <div style={styles.content}>
              <p style={styles.label}>{card.title}</p>
              <p style={styles.value}>{card.value}</p>
              <p style={styles.subtitle}>{card.subtitle}</p>
            </div>
          </div>
        </Box>
      ))}
      <Box
        component={motion.div}
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.35 }}
        sx={{
          flex: '1.3 1 0',
          minWidth: { xs: 0, sm: 260 },
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <TaskStatusDistributionChart distribution={taskStatusDistribution} total={taskStatusTotal} />
      </Box>
    </Box>
  );
}
