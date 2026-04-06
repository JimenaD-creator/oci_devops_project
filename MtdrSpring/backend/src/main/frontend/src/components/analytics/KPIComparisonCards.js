import React from "react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

const kpis = [
  {
    title: "Task Completion Rate",
    baseline: "72%", actual: "85%", improvement: "+13%",
    data: [{ v: 72 }, { v: 75 }, { v: 76 }, { v: 79 }, { v: 82 }, { v: 83 }, { v: 85 }],
  },
  {
    title: "On-Time Delivery",
    baseline: "65%", actual: "72%", improvement: "+7%",
    data: [{ v: 65 }, { v: 66 }, { v: 68 }, { v: 69 }, { v: 70 }, { v: 71 }, { v: 72 }],
  },
  {
    title: "Team Participation",
    baseline: "75%", actual: "88%", improvement: "+13%",
    data: [{ v: 75 }, { v: 78 }, { v: 80 }, { v: 83 }, { v: 85 }, { v: 87 }, { v: 88 }],
  },
  {
    title: "Workload Balance",
    baseline: "0.75", actual: "0.92", improvement: "+0.17",
    data: [{ v: 0.75 }, { v: 0.79 }, { v: 0.82 }, { v: 0.85 }, { v: 0.88 }, { v: 0.90 }, { v: 0.92 }],
  },
];

export default function KPIComparisonCards() {
  return (
    <>
      <style>
        {`
          .kpi-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 16px;
            margin-bottom: 24px;
            font-family: sans-serif;
          }

          @media (min-width: 640px) {
            .kpi-grid { grid-template-columns: repeat(2, 1fr); }
          }

          @media (min-width: 1024px) {
            .kpi-grid { grid-template-columns: repeat(4, 1fr); }
          }

          .kpi-card {
            background-color: white;
            border-radius: 12px;
            border: 1px solid #f3f4f6;
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
            padding: 20px;
          }

          .kpi-title {
            font-size: 12px;
            font-weight: 600;
            color: #6F6F6F;
            margin-bottom: 12px;
            line-height: 1.25;
          }

          .kpi-content-flex {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            margin-bottom: 12px;
          }

          .kpi-label-small {
            font-size: 11px;
            color: #6F6F6F;
          }

          .kpi-value-base {
            font-size: 14px;
            font-weight: 600;
            color: #6F6F6F;
          }

          .kpi-value-actual {
            font-size: 24px;
            font-weight: 700;
            color: #2E2E2E;
          }

          .kpi-badge {
            padding: 4px 8px;
            background-color: #f0fdf4; /* green-50 */
            color: #15803d; /* green-700 */
            font-size: 12px;
            font-weight: 700;
            border-radius: 8px;
            border: 1px solid #dcfce7; /* green-100 */
            display: flex;
            align-items: center;
            gap: 4px;
            flex-shrink: 0;
          }

          .chart-container {
            height: 40px;
          }
        `}
      </style>

      <div className="kpi-grid">
        {kpis.map((kpi, i) => (
          <motion.div
            key={kpi.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="kpi-card"
          >
            <p className="kpi-title">{kpi.title}</p>
            
            <div className="kpi-content-flex">
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '4px' }}>
                  <span className="kpi-label-small">Base:</span>
                  <span className="kpi-value-base">{kpi.baseline}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span className="kpi-label-small">Actual:</span>
                  <span className="kpi-value-actual">{kpi.actual}</span>
                </div>
              </div>

              <span className="kpi-badge">
                <TrendingUp size={12} />
                {kpi.improvement}
              </span>
            </div>

            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={kpi.data}>
                  <Line 
                    type="monotone" 
                    dataKey="v" 
                    stroke="#C74634" 
                    strokeWidth={2} 
                    dot={false} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        ))}
      </div>
    </>
  );
}