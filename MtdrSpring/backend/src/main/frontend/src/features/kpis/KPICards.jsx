import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import { Clock, Users, Scale } from 'lucide-react';
import { motion } from 'framer-motion';
import KpiGaugeCard from './KpiGaugeCard';
import ProductivityGaugeCard from './ProductivityGaugeCard';
import { KPI_TOOLTIPS } from './KpiTooltipParts';

export const KPI_DEFS = [
  {
    key: 'onTimeDelivery',
    title: 'On-Time Delivery',
    format: (v) => `${v}%`,
    icon: Clock,
    tooltip: KPI_TOOLTIPS.onTimeDelivery,
  },
  {
    key: 'teamParticipation',
    title: 'Team Participation',
    format: (v) => `${v}%`,
    icon: Users,
    tooltip: KPI_TOOLTIPS.teamParticipation,
  },
  {
    key: 'workloadBalance',
    title: 'Workload Balance',
    format: (v) => (typeof v === 'number' ? `${Math.round(v * 100)}` : String(v)),
    icon: Scale,
    numeric: (v) => (typeof v === 'number' ? v * 100 : 0),
    tooltip: KPI_TOOLTIPS.workloadBalance,
  },
];

/**
 * KPI snapshot: three gauge cards + Productivity in a 2×2 grid (one column on xs).
 *
 * @param {boolean} compareMode
 * @param {object[]} selectedSprints
 */
export default function KPICards({ compareMode, selectedSprints = [] }) {
  const ordered = useMemo(
    () => [...selectedSprints].sort((a, b) => a.id - b.id),
    [selectedSprints],
  );

  if (!selectedSprints.length) return null;

  return (
    <Box
      sx={{
        display: 'grid',
        width: '100%',
        minWidth: 0,
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
        gap: { xs: 2, sm: 2.5 },
        alignItems: 'start',
      }}
    >
      {KPI_DEFS.map((def, i) => (
        <motion.div
          key={def.key}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, duration: 0.35 }}
          style={{ minWidth: 0 }}
        >
          <KpiGaugeCard
            def={def}
            selectedSprints={selectedSprints}
            compareMode={compareMode}
            ordered={ordered}
          />
        </motion.div>
      ))}
      <motion.div
        key="productivity"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: KPI_DEFS.length * 0.05, duration: 0.35 }}
        style={{ minWidth: 0 }}
      >
        <ProductivityGaugeCard selectedSprints={selectedSprints} compareMode={compareMode} />
      </motion.div>
    </Box>
  );
}
