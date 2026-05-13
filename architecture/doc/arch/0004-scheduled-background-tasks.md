# ADR 4: Scheduled KPI Recalculation

**Date:** 2026-05-12
**Status:** Accepted

## Context
KPIs (Productivity Score, Completion Rate) need to stay up to date without requiring manual triggers for every single task update.

## Decision
We implemented a **Scheduled Batch Processing Strategy**:
* **Cron Jobs:** Using `@Scheduled(cron = "0 0 2 * * *")`, the system automatically recalculates KPIs for all active sprints during low-traffic hours (2:00 AM).
* **On-demand Refresh:** We also provide an on-demand recalculation trigger via the `KpiController` for immediate updates.

## Consequences
* **Pros:** Reduces real-time processing load and ensures metrics are consistent across the entire project.
* **Cons:** There might be a slight delay between a task completion and its reflection in the "Daily KPI" until the next scheduled run or manual refresh.