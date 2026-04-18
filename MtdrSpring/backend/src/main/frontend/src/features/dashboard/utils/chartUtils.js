/** Pure helpers for dashboard developer charts (easy to unit test). */

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
    xs: Math.round(Math.max(280, b * 0.9)),
    sm: Math.round(b),
  };
}
