import React from "react";
import { CheckCircle2, Clock, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

const hoursCard = {
  icon: Clock,
  title: "Total Hours Worked",
  value: "128.5",
  subtitle: "hours logged this sprint",
  trend: "+12% vs last sprint",
};

const styles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "1rem",
    marginBottom: "1.5rem",
  },
  card: {
    backgroundColor: "white",
    borderRadius: "0.75rem",
    border: "1px solid #F3F4F6",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    padding: "1.5rem",
    display: "flex",
    alignItems: "center",
    gap: "1.25rem",
  },
  iconWrapper: {
    width: "3.5rem",
    height: "3.5rem",
    borderRadius: "1rem",
    backgroundColor: "rgba(199,70,52,0.1)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "#6F6F6F",
    marginBottom: "0.25rem",
  },
  value: {
    fontSize: "2.25rem",
    fontWeight: 700,
    color: "#2E2E2E",
    lineHeight: 1,
    marginBottom: "0.25rem",
  },
  subtitle: {
    fontSize: "0.75rem",
    color: "#6F6F6F",
  },
  trend: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: "0.25rem",
    padding: "0.375rem 0.625rem",
    backgroundColor: "#F0FDF4",
    border: "1px solid #DCFCE7",
    borderRadius: "0.5rem",
  },
  trendText: {
    fontSize: "0.75rem",
    fontWeight: 700,
    color: "#16A34A",
  },
};

export default function SummaryCards({ completedTasksCount = 0 }) {
  const cards = [
    {
      icon: CheckCircle2,
      title: "Total Completed Tasks",
      value: String(completedTasksCount),
      subtitle: "tasks done this sprint",
      trend: "+8% vs last sprint",
    },
    hoursCard,
  ];

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
            <card.icon style={{ width: "1.75rem", height: "1.75rem", color: "#C74634" }} />
          </div>
          <div style={styles.content}>
            <p style={styles.label}>{card.title}</p>
            <p style={styles.value}>{card.value}</p>
            <p style={styles.subtitle}>{card.subtitle}</p>
          </div>
          <div style={styles.trend}>
            <TrendingUp style={{ width: "0.875rem", height: "0.875rem", color: "#16A34A" }} />
            <span style={styles.trendText}>{card.trend}</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
