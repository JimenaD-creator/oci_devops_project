import React from 'react';
import { Clock, TrendingUp, CheckCircle2, ListTodo } from 'lucide-react';
import { motion } from 'framer-motion';

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
 */
export default function SummaryCards({
  completedTasksCount = 0,
  totalHoursDisplay = '0',
  pendingTasksCount = 0,
}) {
  const cards = [
    {
      icon: CheckCircle2,
      title: 'Total Completed Tasks',
      value: String(completedTasksCount),
      subtitle: 'tasks done this sprint',
      trend: '+8% vs last sprint',
    },
    {
      icon: Clock,
      title: 'Total Hours Worked',
      value: totalHoursDisplay,
      subtitle: 'hours logged this sprint',
      trend: '+12% vs last sprint',
    },
    {
      icon: ListTodo,
      title: 'Pending Tasks',
      value: String(pendingTasksCount),
      subtitle: 'still open this sprint',
      trend: pendingTasksCount > 0 ? 'In backlog' : 'Sprint clear',
      trendVariant: pendingTasksCount > 0 ? 'positive' : 'neutral',
    },
  ];

  const styles = {
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: '1rem',
      marginBottom: '1.5rem',
    },
    card: {
      ...cardBase,
      borderTop: `3px solid ${ORACLE_RED}`,
      display: 'flex',
      alignItems: 'center',
      gap: '1.25rem',
    },
    iconWrapper: {
      width: '3.5rem',
      height: '3.5rem',
      borderRadius: '1rem',
      backgroundColor: 'rgba(199,70,52,0.1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    content: { flex: 1, minWidth: 0 },
    label: { fontSize: '0.75rem', fontWeight: 600, color: '#6F6F6F', marginBottom: '0.25rem' },
    value: { fontSize: '2.25rem', fontWeight: 700, color: '#2E2E2E', lineHeight: 1, marginBottom: '0.25rem' },
    subtitle: { fontSize: '0.75rem', color: '#6F6F6F' },
    trend: {
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      gap: '0.25rem',
      padding: '0.375rem 0.625rem',
      backgroundColor: '#F0FDF4',
      border: '1px solid #DCFCE7',
      borderRadius: '0.5rem',
    },
    trendNeutral: {
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      gap: '0.25rem',
      padding: '0.375rem 0.625rem',
      backgroundColor: '#F5F5F5',
      border: '1px solid #EEEEEE',
      borderRadius: '0.5rem',
    },
    trendText: { fontSize: '0.75rem', fontWeight: 700, color: '#16A34A' },
    trendTextNeutral: { fontSize: '0.75rem', fontWeight: 700, color: '#616161' },
  };

  return (
    <div style={styles.grid}>
      {cards.map((card, i) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1, duration: 0.4 }}
          style={styles.card}
        >
          <div style={styles.iconWrapper}>
            <card.icon style={{ width: '1.75rem', height: '1.75rem', color: ORACLE_RED }} />
          </div>
          <div style={styles.content}>
            <p style={styles.label}>{card.title}</p>
            <p style={styles.value}>{card.value}</p>
            <p style={styles.subtitle}>{card.subtitle}</p>
          </div>
          <div style={card.trendVariant === 'neutral' ? styles.trendNeutral : styles.trend}>
            <TrendingUp
              style={{
                width: '0.875rem',
                height: '0.875rem',
                color: card.trendVariant === 'neutral' ? '#757575' : '#16A34A',
              }}
            />
            <span style={card.trendVariant === 'neutral' ? styles.trendTextNeutral : styles.trendText}>
              {card.trend}
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
