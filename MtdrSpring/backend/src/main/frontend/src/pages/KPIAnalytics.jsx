import React from "react";
import { Box, Typography } from "@mui/material";
import { Calendar, Target } from "lucide-react";
import KPIComparisonCards from "../components/analytics/KPIComparisonCards";
import IndividualTable from "../components/analytics/IndividualTable";
import DeveloperTable from "../components/analytics/DeveloperTable";

export default function KPIAnalytics() {
  return (
    <>
      <style>
        {`
          .kpi-progress-card {
            background-color: white;
            border-radius: 12px;
            border: 1px solid #F3F4F6;
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
            padding: 20px;
            margin-bottom: 24px;
          }

          .progress-info {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            gap: 16px;
          }

          @media (min-width: 640px) {
            .progress-info { flex-direction: row; align-items: center; }
          }

          .progress-percentage {
            font-size: 36px;
            font-weight: 700;
            color: #C74634;
            margin: 0;
          }

          .progress-track {
            width: 100%;
            height: 12px;
            background-color: #F3F4F6;
            border-radius: 9999px;
            overflow: hidden;
            margin-top: 12px;
          }

          .progress-fill {
            height: 100%;
            background: linear-gradient(to right, #C74634, #e05a4a);
            border-radius: 9999px;
            transition: width 1s ease-in-out;
          }

          .progress-labels {
            display: flex;
            justify-content: space-between;
            margin-top: 4px;
            font-size: 10px;
            color: #6F6F6F;
          }

          .charts-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 20px;
            margin-bottom: 20px;
          }

          @media (min-width: 1024px) {
            .charts-grid {
              grid-template-columns: repeat(5, 1fr);
            }
            .span-3 { grid-column: span 3; }
            .span-2 { grid-column: span 2; }
          }
        `}
      </style>

      <Box sx={{ maxWidth: 1200, width: "100%" }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            mb: 4,
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          <Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                color: "#1A1A1A",
                letterSpacing: "-0.5px",
              }}
            >
              KPI Analytics
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: "#999",
                mt: 0.5,
                display: "flex",
                alignItems: "center",
                gap: 0.75,
              }}
            >
              <Calendar size={14} aria-hidden />
              January – April 2024 · Tracking 20% improvement goal
            </Typography>
          </Box>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              bgcolor: "rgba(199, 70, 52, 0.1)",
              border: "1px solid rgba(199, 70, 52, 0.2)",
              borderRadius: 2,
              px: 2,
              py: 1,
            }}
          >
            <Target size={16} color="#C74634" aria-hidden />
            <Typography sx={{ fontWeight: 700, fontSize: "0.875rem", color: "#C74634" }}>
              Goal: +20% productivity
            </Typography>
          </Box>
        </Box>

        <div className="kpi-progress-card">
          <div className="progress-info">
            <div>
              <h2 style={{ fontSize: "16px", fontWeight: "bold", color: "#2E2E2E", margin: "0 0 4px 0" }}>
                Overall Productivity Improvement
              </h2>
              <p style={{ fontSize: "14px", color: "#6F6F6F", margin: 0 }}>
                Goal: +20% · Projected to reach by:{" "}
                <span style={{ fontWeight: "600", color: "#2E2E2E" }}>Sprint 15</span>
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p className="progress-percentage">+17%</p>
              <p style={{ fontSize: "12px", color: "#6F6F6F", margin: 0 }}>vs baseline Sprint 1</p>
            </div>
          </div>

          <div style={{ marginTop: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "12px", fontWeight: "500", color: "#6F6F6F" }}>
                Progress toward +20% goal
              </span>
              <span style={{ fontSize: "12px", fontWeight: "bold", color: "#C74634" }}>
                85% complete
              </span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: "85%" }} />
            </div>
            <div className="progress-labels">
              <span>Baseline (Sprint 1)</span>
              <span style={{ fontWeight: "600", color: "#C74634" }}>Actual: +17%</span>
              <span>Goal: +20%</span>
            </div>
          </div>
        </div>

        <KPIComparisonCards />

        <DeveloperTable />
        <IndividualTable />
      </Box>
    </>
  );
}
