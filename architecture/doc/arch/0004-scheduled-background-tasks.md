# ADR-0004: Scheduled KPI Recalculation

**Date:** 2026-05-12
**Status:** Accepted

## Context
KPI fields on each sprint (e.g. completion rate, on-time delivery, team participation, workload balance) need to stay up to date without requiring manual triggers for every single task update.

## Decision
We implemented a **Scheduled Batch Processing Strategy**:
* **Cron Jobs:** Using `@Scheduled(cron = "0 0 2 * * *")`, the system automatically recalculates KPIs for all active sprints during low-traffic hours (2:00 AM).
* **On-demand Refresh:** We also provide an on-demand recalculation trigger via the `KpiController` for immediate updates.

## Alternatives considered

* **Recalculate KPIs on every task or assignment write:** Rejected to avoid amplifying write latency and lock contention on hot paths; batch + on-demand keeps the happy path fast.
* **Database-only materialized views / scheduled DB jobs:** Would move logic into SQL and vendor-specific scheduling; harder to test and version alongside application releases, so Spring `@Scheduled` plus `KpiService` was preferred.
* **Cron only, no API trigger:** Would simplify code but frustrate managers who need fresh numbers after bulk edits; on-demand refresh addresses that gap.
* **Event-driven recalculation (domain events after each change):** Attractive for strict freshness; adds event plumbing and idempotency concerns we deferred in favor of a simple nightly sweep plus manual refresh.

## Consequences
* **Pros:** Reduces real-time processing load and ensures metrics are consistent across the entire project.
* **Cons:** There might be a slight delay between a task completion and its reflection in the "Daily KPI" until the next scheduled run or manual refresh.