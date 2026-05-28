/** Pure helpers for dashboard developer charts. */

/** Completed tasks per hour worked; null when not measurable. */
export function computeTasksPerHour(completed, hours) {
  const c = Math.max(0, Number(completed) || 0);
  const h = Math.max(0, Number(hours) || 0);
  if (h <= 0 || c <= 0) return null;
  return c / h;
}

export function formatTasksPerHour(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return Number(value).toFixed(2);
}

/** Minimum sample before showing per-developer throughput in tables. */
export const THROUGHPUT_MIN_COMPLETED = 2;
export const THROUGHPUT_MIN_HOURS = 2;

export function isThroughputSampleReliable(completed, hours) {
  const c = Math.max(0, Number(completed) || 0);
  const h = Math.max(0, Number(hours) || 0);
  return c >= THROUGHPUT_MIN_COMPLETED && h >= THROUGHPUT_MIN_HOURS;
}

export function formatThroughputHours(hours) {
  const n = Math.max(0, Number(hours) || 0);
  if (n <= 0) return '0 h';
  const rounded = Math.round(n);
  if (Math.abs(n - rounded) < 0.05) return `${rounded} h`;
  return `${n.toFixed(1)} h`;
}

/** Human-readable basis for throughput (completed tasks and hours logged). */
export function formatThroughputContext(completed, hours) {
  const c = Math.max(0, Number(completed) || 0);
  const h = Math.max(0, Number(hours) || 0);
  return `${c} completed · ${formatThroughputHours(h)}`;
}

/**
 * Throughput cell: ratio only when sample is large enough; always includes tooltip context.
 */
export function buildThroughputCellMeta(completed, hours) {
  const c = Math.max(0, Number(completed) || 0);
  const h = Math.max(0, Number(hours) || 0);
  const reliable = isThroughputSampleReliable(c, h);
  const ratio = computeTasksPerHour(c, h);
  const context = formatThroughputContext(c, h);
  return {
    completed: c,
    hours: h,
    reliable,
    ratio,
    context,
    display: reliable ? formatTasksPerHour(ratio) : '—',
  };
}

export function buildProductivityScoreAxisDomainTicks() {
  return { domain: [0, 100], ticks: [0, 20, 40, 60, 80, 100] };
}

export function buildTasksPerHourAxisDomainTicks(maxVal) {
  const raw = Math.max(0, Number(maxVal) || 0);
  const padded = Math.max(raw * 1.2, raw + 0.05, 0.1);
  const domainMax = Math.ceil(padded * 20) / 20;
  let step = 0.05;
  if (domainMax > 0.5) step = 0.1;
  if (domainMax > 1.2) step = 0.2;
  const ticks = [];
  for (let v = 0; v <= domainMax + 1e-9; v += step) {
    ticks.push(Number(v.toFixed(2)));
  }
  if (ticks.length === 0 || ticks[ticks.length - 1] < domainMax) {
    ticks.push(Number(domainMax.toFixed(2)));
  }
  return { domain: [0, domainMax], ticks, domainMax };
}

export function maxCompareWorkloadStack(rows, sprintDefs) {
  let m = 0;
  if (!rows?.length || !sprintDefs?.length) return m;
  for (const row of rows) {
    for (const sp of sprintDefs) {
      const h = (Number(row[`wc_${sp.id}`]) || 0) + (Number(row[`wo_${sp.id}`]) || 0);
      m = Math.max(m, h);
    }
  }
  return m;
}

export function maxSingleWorkloadStack(rows) {
  let m = 0;
  for (const row of rows || []) {
    m = Math.max(m, (Number(row.completed) || 0) + (Number(row.pending) || 0));
  }
  return m;
}

export function buildTaskAxisDomainTicks(maxStack) {
  const padded = Math.max(maxStack * 1.25, maxStack + 3, 8);
  /** Mismo tope que con ticks de 1 en 1 (ceil del padded). */
  const domainMax = Math.max(1, Math.ceil(padded));
  /** Ticks más separados: nunca de 1 en 1; el dominio [0, domainMax] no cambia. */
  let step = 2;
  if (domainMax > 48) step = 5;
  if (domainMax > 120) step = 10;
  const ticks = [];
  for (let v = 0; v < domainMax; v += step) ticks.push(v);
  if (ticks.length === 0 || ticks[ticks.length - 1] !== domainMax) ticks.push(domainMax);
  return { domain: [0, domainMax], ticks, domainMax };
}

export function maxSingleHoursGrouped(rows) {
  let m = 0;
  for (const row of rows || []) {
    const a = Number(row.hWorked) || 0;
    const b = Number(row.hAssigned) || 0;
    m = Math.max(m, a, b);
  }
  return m;
}

export function maxCompareHoursGrouped(rows, sprintDefs) {
  let m = 0;
  if (!rows?.length || !sprintDefs?.length) return m;
  for (const row of rows) {
    for (const sp of sprintDefs) {
      const id = sp.id;
      const w = Number(row[`hw_${id}`] || 0);
      const a = Number(row[`ha_${id}`] || 0);
      m = Math.max(m, w, a);
    }
  }
  return m;
}

/** Same tick strategy as tasks axis, for hour totals on stacked bullet bars. */
export function buildHoursAxisDomainTicks(maxHours) {
  const padded = Math.max(maxHours * 1.45, maxHours + 4, 10);
  const domainMax = Math.max(1, Math.ceil(padded));
  let step = 4;
  if (domainMax > 40) step = 6;
  if (domainMax > 80) step = 10;
  if (domainMax > 160) step = 20;
  const ticks = [];
  for (let v = 0; v < domainMax; v += step) ticks.push(v);
  if (ticks.length === 0 || ticks[ticks.length - 1] !== domainMax) ticks.push(domainMax);
  return { domain: [0, domainMax], ticks, domainMax };
}

/** Finer Y-axis ticks for compare-mode workload chart (does not affect combo/single). */
export function buildCompareTaskAxisDomainTicks(maxStack) {
  const padded = Math.max(maxStack * 1.06, maxStack + 0.5, 5);
  const domainMax = Math.max(1, Math.ceil(padded));
  let step = 1;
  if (domainMax > 20) step = 2;
  if (domainMax > 50) step = 3;
  if (domainMax > 100) step = 5;
  const ticks = [];
  for (let v = 0; v < domainMax; v += step) ticks.push(v);
  if (ticks.length === 0 || ticks[ticks.length - 1] !== domainMax) ticks.push(domainMax);
  return { domain: [0, domainMax], ticks, domainMax };
}

/** Finer Y-axis ticks for compare-mode hours chart (does not affect combo/single). */
export function buildCompareHoursAxisDomainTicks(maxHours) {
  const padded = Math.max(maxHours * 1.08, maxHours + 1, 6);
  const domainMax = Math.max(1, Math.ceil(padded));
  let step = 1;
  if (domainMax > 12) step = 2;
  if (domainMax > 30) step = 3;
  if (domainMax > 60) step = 4;
  if (domainMax > 120) step = 6;
  const ticks = [];
  for (let v = 0; v < domainMax; v += step) ticks.push(v);
  if (ticks.length === 0 || ticks[ticks.length - 1] !== domainMax) ticks.push(domainMax);
  return { domain: [0, domainMax], ticks, domainMax };
}

export function maxSingleComboRange(developers) {
  let maxT = 0;
  let maxH = 0;
  for (const d of developers || []) {
    maxT = Math.max(maxT, Number(d.completed) || 0);
    maxH = Math.max(maxH, Number(d.hours) || 0);
  }
  return { maxTasks: maxT, maxHours: maxH };
}

export function maxCompareComboRange(comboRows, sprintDefs) {
  let maxT = 0;
  let maxH = 0;
  if (!comboRows?.length || !sprintDefs?.length) return { maxTasks: 0, maxHours: 0 };
  for (const row of comboRows) {
    for (const sp of sprintDefs) {
      maxT = Math.max(maxT, Number(row[`cb_${sp.id}`]) || 0);
      maxH = Math.max(maxH, Number(row[`ln_${sp.id}`]) || 0);
    }
  }
  return { maxTasks: maxT, maxHours: maxH };
}

/** Extra chart height when task/hour values are large (dual-axis combo needs more vertical room). */
export function comboHeightExtraFromRange(maxTasks, maxHours) {
  const t = Math.max(0, Number(maxTasks) || 0);
  const h = Math.max(0, Number(maxHours) || 0);
  if (t === 0 && h === 0) return 0;
  return Math.min(220, Math.round(8 + 3.2 * t + 1.2 * h));
}

/**
 * Height derived from selection (sprints × devs). Only extra‑small viewports get a slight shrink;
 * from `sm` (600px) up — tablet/escritorio — se usa el 100 % del valor calculado.
 */
export function compareChartHeights(base) {
  const b = Math.max(280, base);
  return {
    xs: Math.round(Math.max(260, b * 0.9)),
    sm: Math.round(b),
  };
}
