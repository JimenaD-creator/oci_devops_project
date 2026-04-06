import React from "react";
import { Sparkles, TrendingUp, AlertTriangle, Lightbulb, Star } from "lucide-react";
import { motion } from "framer-motion";

const insights = [
  {
    icon: TrendingUp,
    iconColor: "#16a34a",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    text: "La productividad ha aumentado 17% en los últimos 12 sprints, superando el ritmo requerido para alcanzar la meta del 20%.",
  },
  {
    icon: Lightbulb,
    iconColor: "#2563eb",
    bg: "#eff6ff",
    border: "#bfdbfe",
    text: "Proyección: Se alcanzará el 20% de mejora en Sprint 15 si se mantiene la tendencia actual (+1.5% por sprint).",
  },
  {
    icon: AlertTriangle,
    iconColor: "#d97706",
    bg: "#fffbeb",
    border: "#fef3c7",
    text: "On-Time Delivery es el KPI con menor mejora (+7%). Enfocar esfuerzos en estimación de tareas para acelerar este indicador.",
  },
  {
    icon: Star,
    iconColor: "#C74634",
    bg: "rgba(199, 70, 52, 0.05)",
    border: "rgba(199, 70, 52, 0.2)",
    text: "María García contribuye con el 10% de la mejora total (mayor contribuidor individual). Considerar como modelo para el equipo.",
  },
];

export default function AnalyticsInsights() {
  return (
    <>
      <style>
        {`
          .insights-card-container {
            background-color: white;
            border-radius: 12px;
            border: 1px solid #f3f4f6;
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
            border-left: 4px solid #c74634;
            font-family: sans-serif;
          }

          .insights-header {
            padding: 20px 20px 12px 20px;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .insights-grid {
            padding: 0 20px 20px 20px;
            display: grid;
            grid-template-columns: 1fr;
            gap: 12px;
          }

          @media (min-width: 768px) {
            .insights-grid {
              grid-template-columns: repeat(2, 1fr);
            }
          }

          .insight-item {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 14px;
            border-radius: 8px;
            border: 1px solid;
          }

          .insight-text {
            font-size: 14px;
            color: #2e2e2e;
            line-height: 1.6;
            margin: 0;
          }

          .icon-style {
            width: 16px;
            height: 16px;
            margin-top: 2px;
            flex-shrink: 0;
          }
        `}
      </style>

      <div className="insights-card-container">
        <div className="insights-header">
          <Sparkles size={20} color="#c74634" />
          <h3 style={{ fontSize: "14px", fontWeight: "bold", color: "#2e2e2e", margin: 0 }}>
            Analytics Insights
          </h3>
        </div>

        <div className="insights-grid">
          {insights.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="insight-item"
              style={{
                backgroundColor: item.bg,
                borderColor: item.border,
              }}
            >
              <item.icon className="icon-style" style={{ color: item.iconColor }} />
              <p className="insight-text">{item.text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </>
  );
}