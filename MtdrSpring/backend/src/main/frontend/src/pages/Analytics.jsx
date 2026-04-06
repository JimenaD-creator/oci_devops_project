import React from "react";
import { Calendar, Target } from "lucide-react";
import AnalyticsInsights from "../components/analytics/analyticsInsights";
import KPIComparisonCards from "../components/analytics/KPIComparisonCards";
import IndividualTable from "../components/analytics/IndividualTable";

export default function Analytics() {
  return (
    <>
      <style>
        {`
          .analytics-page {
            min-height: 100vh;
            background-color: #F5F5F5;
            font-family: system-ui, -apple-system, sans-serif;
          }

          .analytics-container {
            padding: 24px;
            max-width: 1400px;
            margin: 0 auto;
          }

          @media (min-width: 1024px) {
            .analytics-container { padding: 32px; }
          }

          /* Header Styles */
          .header-flex {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 24px;
          }

          @media (min-width: 640px) {
            .header-flex { flex-direction: row; align-items: center; }
          }

          .header-title {
            font-size: 24px;
            font-weight: 700;
            color: #2E2E2E;
            margin: 0;
          }

          .header-subtitle {
            font-size: 14px;
            color: #6F6F6F;
            margin-top: 2px;
            display: flex;
            align-items: center;
            gap: 6px;
          }

          .meta-badge {
            display: flex;
            align-items: center;
            gap: 8px;
            background-color: rgba(199, 70, 52, 0.1);
            border: 1px solid rgba(199, 70, 52, 0.2);
            border-radius: 8px;
            padding: 8px 16px;
          }

          .meta-badge span {
            font-size: 14px;
            font-weight: 700;
            color: #C74634;
          }

          /* Progress Card */
          .progress-card {
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

          /* Progress Bar */
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

          /* Chart Grid */
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

      <div className="analytics-page">
        <div className="analytics-container">
          {/* Header */}
          <div className="header-flex">
            <div>
              <h1 className="header-title">Productivity Analytics</h1>
              <p className="header-subtitle">
                <Calendar size={14} />
                Enero – Abril 2024 · Tracking 20% Improvement Goal
              </p>
            </div>
            <div className="meta-badge">
              <Target size={16} color="#C74634" />
              <span>Meta: +20% Productivity</span>
            </div>
          </div>

          {/* Overall Progress Card */}
          <div className="progress-card">
            <div className="progress-info">
              <div>
                <h2 style={{ fontSize: "16px", fontWeight: "bold", color: "#2E2E2E", margin: "0 0 4px 0" }}>
                  Overall Productivity Improvement
                </h2>
                <p style={{ fontSize: "14px", color: "#6F6F6F", margin: 0 }}>
                  Meta: +20% · Proyectado alcanzarse en:{" "}
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
                  Progreso hacia meta del +20%
                </span>
                <span style={{ fontSize: "12px", fontWeight: "bold", color: "#C74634" }}>
                  85% completado
                </span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: "85%" }} />
              </div>
              <div className="progress-labels">
                <span>Baseline (Sprint 1)</span>
                <span style={{ fontWeight: "600", color: "#C74634" }}>Actual: +17%</span>
                <span>Meta: +20%</span>
              </div>
            </div>
          </div>

          <KPIComparisonCards/>

          <IndividualTable />
          <AnalyticsInsights />
        </div>
      </div>
    </>
  );
}