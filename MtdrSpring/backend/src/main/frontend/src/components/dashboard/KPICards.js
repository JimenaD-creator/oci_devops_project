import React, { useMemo } from "react";
import { CheckCircle2, Clock, Users, Scale, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { Box, Typography } from "@mui/material";

const KPI_DEFS = [
  { key: "completionRate", title: "Task Completion Rate", format: (v) => `${v}%`, icon: CheckCircle2 },
  { key: "onTimeDelivery", title: "On-Time Delivery", format: (v) => `${v}%`, icon: Clock },
  { key: "teamParticipation", title: "Team Participation", format: (v) => `${v}%`, icon: Users },
  {
    key: "workloadBalance",
    title: "Workload Balance",
    format: (v) => (typeof v === "number" ? `${Math.round(v * 100)}` : String(v)),
    icon: Scale,
    numeric: (v) => (typeof v === "number" ? v * 100 : 0),
  },
];

const styles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "1rem",
    marginBottom: "1.5rem",
  },
  card: {
    backgroundColor: "white",
    borderRadius: "12px",
    border: "1px solid #EFEFEF",
    boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
    padding: "1.25rem",
    transition: "box-shadow 0.2s ease",
  },
  cardHover: {
    boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    marginBottom: "1rem",
    paddingBottom: "0.75rem",
    borderBottom: "1px solid #F5F5F5",
  },
  iconWrapper: {
    width: "2.5rem",
    height: "2.5rem",
    borderRadius: "10px",
    backgroundColor: "rgba(199,70,52,0.1)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: "0.8125rem",
    color: "#1A1A1A",
    fontWeight: 700,
  },
  valueSingle: {
    fontSize: "1.85rem",
    fontWeight: 800,
    color: "#2E2E2E",
    lineHeight: 1.1,
  },
  subtitle: {
    fontSize: "0.6875rem",
    color: "#999",
    marginTop: "0.35rem",
  },
};

function numericForKpi(def, kpis) {
  const v = kpis?.[def.key];
  if (v == null) return null;
  if (def.numeric) return def.numeric(v);
  return typeof v === "number" ? v : parseFloat(v);
}

function CompareKpiRows({ def, orderedSprints }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.1 }}>
      {orderedSprints.map((sp, idx) => {
        const val = sp.kpis?.[def.key];
        const display = val != null ? def.format(val) : "—";
        const cur = numericForKpi(def, sp.kpis);
        const prev = idx > 0 ? numericForKpi(def, orderedSprints[idx - 1].kpis) : null;
        const improved = prev != null && cur != null && cur > prev;

        return (
          <Box
            key={sp.id}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              py: 0.25,
            }}
          >
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                bgcolor: sp.accentColor,
                flexShrink: 0,
              }}
            />
            <Typography variant="body2" sx={{ flex: 1, color: "#555", fontWeight: 600, fontSize: "0.8rem" }}>
              {sp.shortLabel}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 800, color: "#1A1A1A", fontSize: "0.9rem", minWidth: 40, textAlign: "right" }}>
              {display}
            </Typography>
            {improved ? (
              <TrendingUp style={{ width: 18, height: 18, color: "#2E7D32", flexShrink: 0 }} />
            ) : (
              <Box sx={{ width: 18, flexShrink: 0 }} />
            )}
          </Box>
        );
      })}
    </Box>
  );
}

/**
 * @param {boolean} compareMode
 * @param {object[]} selectedSprints
 */
export default function KPICards({ compareMode, selectedSprints = [] }) {
  const ordered = useMemo(
    () => [...selectedSprints].sort((a, b) => a.id - b.id),
    [selectedSprints]
  );

  const cards = useMemo(() => {
    const sp = selectedSprints[0];
    return KPI_DEFS.map((def) => {
      if (compareMode && selectedSprints.length > 1) {
        return { ...def, compare: true, ordered };
      }
      const v = sp?.kpis?.[def.key];
      return {
        ...def,
        compare: false,
        displayValue: v != null ? def.format(v) : "—",
      };
    });
  }, [compareMode, selectedSprints, ordered]);

  if (!selectedSprints.length) return null;

  return (
    <div style={styles.grid}>
      {cards.map((kpi, i) => (
        <motion.div
          key={kpi.title}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, duration: 0.35 }}
          style={styles.card}
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, styles.cardHover)}
          onMouseLeave={(e) => Object.assign(e.currentTarget.style, styles.card)}
        >
          <div style={styles.header}>
            <div style={styles.iconWrapper}>
              <kpi.icon style={{ width: "1.2rem", height: "1.2rem", color: "#C74634" }} />
            </div>
            <span style={styles.title}>{kpi.title}</span>
          </div>
          {kpi.compare ? (
            <CompareKpiRows def={kpi} orderedSprints={kpi.ordered} />
          ) : (
            <>
              <p style={styles.valueSingle}>{kpi.displayValue}</p>
              <p style={styles.subtitle}>vs sprint anterior</p>
            </>
          )}
        </motion.div>
      ))}
    </div>
  );
}
