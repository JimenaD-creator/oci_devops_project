import React from "react";
import { CheckCircle2, Clock, Users, Scale } from "lucide-react";
import { motion } from "framer-motion";

const kpis = [
  {
    title: "Task Completion Rate",
    value: "85%",
    change: "+5%",
    positive: true,
    subtitle: "vs sprint anterior",
    icon: CheckCircle2,
  },
  {
    title: "On-Time Delivery",
    value: "72%",
    change: "-2%",
    positive: false,
    subtitle: "vs sprint anterior",
    icon: Clock,
  },
  {
    title: "Team Participation",
    value: "88%",
    change: "+3%",
    positive: true,
    subtitle: "vs sprint anterior",
    icon: Users,
  },
  {
    title: "Workload Balance",
    value: "0.92",
    change: "+0.1",
    positive: true,
    subtitle: "índice de balance",
    icon: Scale,
  },
];

const styles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "1rem",
    marginBottom: "1.5rem",
  },
  card: {
    backgroundColor: "white",
    borderRadius: "0.75rem",
    border: "1px solid #F3F4F6",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    padding: "1.25rem",
    transition: "box-shadow 0.2s ease",
    cursor: "default",
  },
  cardHover: {
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: "0.75rem",
  },
  iconWrapper: {
    width: "2.5rem",
    height: "2.5rem",
    borderRadius: "0.75rem",
    backgroundColor: "rgba(199,70,52,0.1)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  badgePositive: {
    fontSize: "0.75rem",
    fontWeight: 600,
    padding: "0.125rem 0.5rem",
    borderRadius: "9999px",
    backgroundColor: "#F0FDF4",
    color: "#16A34A",
  },
  badgeNegative: {
    fontSize: "0.75rem",
    fontWeight: 600,
    padding: "0.125rem 0.5rem",
    borderRadius: "9999px",
    backgroundColor: "#FEF2F2",
    color: "#DC2626",
  },
  value: {
    fontSize: "1.75rem",
    fontWeight: 700,
    color: "#2E2E2E",
    lineHeight: 1,
    marginBottom: "0.25rem",
  },
  title: {
    fontSize: "0.75rem",
    color: "#6F6F6F",
    fontWeight: 500,
  },
  subtitle: {
    fontSize: "0.6875rem",
    color: "rgba(111,111,111,0.7)",
    marginTop: "0.125rem",
  },
};

export default function KPICards() {
  return (
    <div style={styles.grid}>
      {kpis.map((kpi, i) => (
        <motion.div
          key={kpi.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, duration: 0.4 }}
          style={styles.card}
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, styles.cardHover)}
          onMouseLeave={(e) => Object.assign(e.currentTarget.style, styles.card)}
        >
          <div style={styles.header}>
            <div style={styles.iconWrapper}>
              <kpi.icon style={{ width: "1.25rem", height: "1.25rem", color: "#C74634" }} />
            </div>
            <span style={kpi.positive ? styles.badgePositive : styles.badgeNegative}>
              {kpi.change}
            </span>
          </div>
          <p style={styles.value}>{kpi.value}</p>
          <p style={styles.title}>{kpi.title}</p>
          <p style={styles.subtitle}>{kpi.subtitle}</p>
        </motion.div>
      ))}
    </div>
  );
}
