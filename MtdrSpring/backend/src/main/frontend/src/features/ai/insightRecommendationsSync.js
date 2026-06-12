import {
  isValidWorkloadDeveloperName,
  isValidWorkloadMoveRecommendation,
  shouldDropOnTimeEstimationRecommendation,
} from './aiInsightsConstants';

const GENERIC_WORKLOAD_RE = [
  /\bbalanced\s+across\s+developers\b/i,
  /\bkeep\s+assignments\s+stable\b/i,
  /\bdistribution\s+is\s+balanced\b/i,
  /\bno\s+redistribution\s+(?:is\s+)?needed\b/i,
  /\bassignments\s+are\s+(?:already\s+)?balanced\b/i,
  /\bfocus\s+on\s+unblocking\b/i,
];

/** Shown when workload is even and no concrete move is required. */
export const BALANCED_WORKLOAD_RECOMMENDATION_TEXT =
  'Current task status distribution is balanced across developers. Keep assignments stable and focus on unblocking tasks in In progress/In review.';

const EXPLICIT_WORKLOAD_MOVE_RE = [
  /\bmove\s+~?\s*\d+\s+task(?:\(s\))?\s+from\s+/i,
  /\bshift\s+about\s+\d+\s+task(?:\(s\))?\s+toward\s+/i,
  /\bmove\s+~?\s*\d+\s+task(?:\(s\))?\s+from\s+[^.]+\s+to\s+/i,
];

function normalizeRecommendationKey(rec) {
  const cat = String(rec?.category ?? '')
    .trim()
    .toLowerCase();
  const text = String(rec?.text ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  return `${cat}::${text}`;
}

function movePairKey(from, to) {
  return `${String(from).trim().toLowerCase()}->${String(to).trim().toLowerCase()}`;
}

function isWorkloadCategory(rec) {
  return String(rec?.category ?? '').toLowerCase() === 'workload_redistribution';
}

/** Gemini/backend filler when load is even — not an actionable move. */
export function isGenericWorkloadRedistributionText(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return true;
  if (GENERIC_WORKLOAD_RE.some((re) => re.test(raw))) return true;
  if (/^rebalance\s+workload\s+for\s+/i.test(raw) && !/\bto\s+[A-Za-z]/i.test(raw)) return true;
  return false;
}

/** Recommendation names a concrete from → to move. */
export function hasExplicitWorkloadMove(text) {
  const raw = String(text ?? '').trim();
  if (!raw || isGenericWorkloadRedistributionText(raw)) return false;
  return EXPLICIT_WORKLOAD_MOVE_RE.some((re) => re.test(raw));
}

function formatWorkloadRecommendationText({ from, to, tasksToMove, reason }) {
  const n = Number(tasksToMove);
  const head = `Move ~${n} task(s) from ${from} to ${to}`;
  const rs = typeof reason === 'string' ? reason.trim() : '';
  return rs ? `${head}: ${rs}` : `${head}.`;
}

function toWorkloadRecommendationItem(row) {
  const from = String(row.from).trim();
  const to = String(row.to).trim();
  const n = Number(row.tasksToMove);
  return {
    category: 'workload_redistribution',
    text: formatWorkloadRecommendationText({
      from,
      to,
      tasksToMove: n,
      reason: row.reason,
    }),
  };
}

function findTeamDeveloper(teamDevelopers, name) {
  const key = String(name ?? '')
    .trim()
    .toLowerCase();
  if (!key) return null;
  return (
    (teamDevelopers || []).find(
      (d) =>
        String(d?.name ?? '')
          .trim()
          .toLowerCase() === key,
    ) ?? null
  );
}

/** Names of developers with at least one active blocked assignment this sprint. */
export function blockedDeveloperNamesFromInsights(insights) {
  const blocked = new Set();
  const rows = insights?.blockedAssignments;
  if (!Array.isArray(rows)) return blocked;
  rows.forEach((row) => {
    const name = String(row?.reportedByDeveloperName ?? row?.developerName ?? row?.assignee ?? '')
      .trim()
      .toLowerCase();
    if (name) blocked.add(name);
  });
  return blocked;
}

function isBlockedDeveloperName(name, blockedDeveloperNames) {
  const key = String(name ?? '')
    .trim()
    .toLowerCase();
  return Boolean(key && blockedDeveloperNames?.has?.(key));
}

function pendingTasksForDeveloper(dev) {
  if (!dev) return 0;
  if (typeof dev.pending === 'number' && Number.isFinite(dev.pending)) {
    return Math.max(0, Math.round(dev.pending));
  }
  const assigned = Number(dev.assigned) || 0;
  const completed = Number(dev.completed) || 0;
  return Math.max(0, assigned - completed);
}

/** Same overload signal as Team workload chips (`developerInsights[].overloaded`). */
export function hasTeamOverloadFlag(developerInsights) {
  if (!Array.isArray(developerInsights)) return false;
  return developerInsights.some((dev) => dev?.overloaded === true);
}

function workedHoursForDeveloper(dev) {
  return Math.max(0, Number(dev?.hours) || 0);
}

/** Receiver must have less open load and must not already carry more worked hours than the sender. */
export function isValidRedistributionPair(fromDev, toDev) {
  if (!fromDev || !toDev) return false;
  const fromOpen = pendingTasksForDeveloper(fromDev);
  const toOpen = pendingTasksForDeveloper(toDev);
  if (fromOpen > 0 && toOpen >= fromOpen) return false;
  const fromHours = workedHoursForDeveloper(fromDev);
  const toHours = workedHoursForDeveloper(toDev);
  if (toHours > fromHours) return false;
  return true;
}

function participationPctForDeveloper(dev) {
  const h = Math.max(0, Number(dev?.hours) || 0);
  const est = Math.max(0, Number(dev?.assignedHoursEstimate) || 0);
  if (est <= 0) return h > 0 ? 0 : 100;
  return Math.min(100, Math.round((100 * h) / est));
}

function sortRedistributionReceivers(a, b) {
  return (
    a.hours - b.hours ||
    a.participation - b.participation ||
    a.assigned - b.assigned ||
    a.name.localeCompare(b.name)
  );
}

/**
 * Prefer teammates who finished their assignments but logged fewer hours / lower participation.
 * Falls back to lightest open load when no one has cleared their queue yet.
 */
export function pickRedistributionReceiver(teamDevelopers, fromName, blockedDeveloperNames = null) {
  const fromKey = String(fromName ?? '')
    .trim()
    .toLowerCase();
  const blocked = blockedDeveloperNames instanceof Set ? blockedDeveloperNames : new Set();
  const fromDev = findTeamDeveloper(teamDevelopers, fromName);
  const fromOpen = pendingTasksForDeveloper(fromDev);
  const candidates = (teamDevelopers || [])
    .filter((d) => {
      const n = String(d?.name ?? '').trim();
      return (
        n &&
        n.toLowerCase() !== fromKey &&
        isValidWorkloadDeveloperName(n) &&
        !isBlockedDeveloperName(n, blocked)
      );
    })
    .filter((d) => fromOpen <= 0 || pendingTasksForDeveloper(d) < fromOpen)
    .filter((d) => !fromDev || workedHoursForDeveloper(d) <= workedHoursForDeveloper(fromDev))
    .map((d) => {
      const assigned = Number(d.assigned) || 0;
      const pending = pendingTasksForDeveloper(d);
      return {
        name: String(d.name).trim(),
        pending,
        assigned,
        hours: Number(d.hours) || 0,
        participation: participationPctForDeveloper(d),
      };
    });

  const finishedAssigned = candidates
    .filter((c) => c.assigned > 0 && c.pending === 0)
    .sort(sortRedistributionReceivers);
  if (finishedAssigned.length > 0) {
    return finishedAssigned[0].name;
  }

  const noPending = candidates.filter((c) => c.pending === 0).sort(sortRedistributionReceivers);
  if (noPending.length > 0) {
    return noPending[0].name;
  }

  const byLoad = [...candidates].sort(
    (a, b) =>
      a.pending - b.pending ||
      a.hours - b.hours ||
      a.participation - b.participation ||
      a.assigned - b.assigned ||
      a.name.localeCompare(b.name),
  );
  return byLoad[0]?.name ?? null;
}

/** @deprecated Use pickRedistributionReceiver */
export function pickLeastLoadedReceiver(teamDevelopers, fromName) {
  return pickRedistributionReceiver(teamDevelopers, fromName);
}

/**
 * Parse "moving ~2 task(s) to Alice" from developer insight prose (Team + backend enrichment).
 * @returns {{ tasksToMove: number, to: string }|null}
 */
export function parseMoveSuggestionFromInsight(insightText) {
  const text = String(insightText ?? '').trim();
  if (!text) return null;

  const patterns = [
    /(?:consider\s+)?moving\s+~?\s*(\d+)\s+task(?:\(s\))?\s+to\s+([^(.]+?)(?:\s*\(|\.|,|$)/i,
    /move\s+~?\s*(\d+)\s+task(?:\(s\))?\s+to\s+([^(.]+?)(?:\s*\(|\.|,|$)/i,
    /rebalance\s+~?\s*(\d+)\s+task(?:\(s\))?\s+(?:from\s+[^.]+\s+)?to\s+([^(.]+?)(?:\s*\(|\.|,|$)/i,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const tasksToMove = Number(m[1]);
    const to = String(m[2] ?? '').trim();
    if (Number.isFinite(tasksToMove) && tasksToMove >= 1 && isValidWorkloadDeveloperName(to)) {
      return { tasksToMove, to };
    }
  }
  return null;
}

function suggestTasksToMove(fromName, teamDevelopers) {
  const teamDev = findTeamDeveloper(teamDevelopers, fromName);
  const pending = pendingTasksForDeveloper(teamDev);
  if (pending >= 2) return Math.max(1, Math.ceil(pending / 2));
  return 1;
}

/**
 * Structured move rows derived from Team-aligned `developerInsights` overload flags.
 * @returns {Array<{ from: string, to: string, tasksToMove: number, reason?: string }>}
 */
export function workloadRowsFromDeveloperInsights(
  developerInsights,
  teamDevelopers = [],
  blockedDeveloperNames = null,
) {
  if (!Array.isArray(developerInsights)) return [];

  const blocked = blockedDeveloperNames instanceof Set ? blockedDeveloperNames : new Set();
  const rows = [];
  const seenFrom = new Set();

  for (const dev of developerInsights) {
    if (dev?.overloaded !== true) continue;

    const from = String(dev.developerName ?? '').trim();
    if (!isValidWorkloadDeveloperName(from)) continue;

    const fromKey = from.toLowerCase();
    if (seenFrom.has(fromKey)) continue;

    const toStructured = String(dev.suggestedMoveTo ?? '').trim();
    const nStructured = Number(dev.suggestedTasksToMove);
    if (
      isValidWorkloadMoveRecommendation({
        from,
        to: toStructured,
        tasksToMove: nStructured,
      }) &&
      !isBlockedDeveloperName(toStructured, blocked)
    ) {
      rows.push({
        from,
        to: toStructured,
        tasksToMove: nStructured,
        reason: typeof dev.insight === 'string' ? dev.insight : '',
      });
      seenFrom.add(fromKey);
      continue;
    }

    const parsed = parseMoveSuggestionFromInsight(dev.insight);
    if (
      parsed &&
      isValidWorkloadMoveRecommendation({
        from,
        to: parsed.to,
        tasksToMove: parsed.tasksToMove,
      }) &&
      !isBlockedDeveloperName(parsed.to, blocked)
    ) {
      rows.push({
        from,
        to: parsed.to,
        tasksToMove: parsed.tasksToMove,
        reason: typeof dev.insight === 'string' ? dev.insight : '',
      });
      seenFrom.add(fromKey);
      continue;
    }

    const receiver = pickRedistributionReceiver(teamDevelopers, from, blocked);
    if (receiver) {
      rows.push({
        from,
        to: receiver,
        tasksToMove: suggestTasksToMove(from, teamDevelopers),
        reason: typeof dev.insight === 'string' ? dev.insight : '',
      });
      seenFrom.add(fromKey);
    }
  }

  return rows;
}

function buildOpenLoadReason(from, to, teamDevelopers) {
  const fromDev = findTeamDeveloper(teamDevelopers, from);
  const toDev = findTeamDeveloper(teamDevelopers, to);
  const fromOpen = pendingTasksForDeveloper(fromDev);
  const toOpen = pendingTasksForDeveloper(toDev);
  return `${from} has ${fromOpen} open task(s) vs ${to}'s ${toOpen}; shifting work balances overall load across the team.`;
}

function refineStructuredWorkloadRows(rows, teamDevelopers, blockedDeveloperNames) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  return rows
    .map((row) => {
      const fromDev = findTeamDeveloper(teamDevelopers, row.from);
      const toDev = findTeamDeveloper(teamDevelopers, row.to);
      if (!fromDev || !toDev) return row;
      if (!isValidRedistributionPair(fromDev, toDev)) {
        const replacement = pickRedistributionReceiver(teamDevelopers, row.from, blockedDeveloperNames);
        if (replacement && replacement !== row.to) {
          return {
            ...row,
            to: replacement,
            reason: buildOpenLoadReason(row.from, replacement, teamDevelopers),
          };
        }
      }
      return row;
    })
    .filter((row) => {
      const fromDev = findTeamDeveloper(teamDevelopers, row.from);
      const toDev = findTeamDeveloper(teamDevelopers, row.to);
      if (!fromDev || !toDev) return true;
      return isValidRedistributionPair(fromDev, toDev);
    });
}

function parseExplicitWorkloadMove(text) {
  const raw = String(text ?? '').trim();
  const m = raw.match(/move\s+~?\s*(\d+)\s+task(?:\(s\))?\s+from\s+(.+?)\s+to\s+([^:.]+)/i);
  if (!m) return null;
  const tasksToMove = Number(m[1]);
  const from = String(m[2] ?? '').trim();
  const to = String(m[3] ?? '').trim();
  if (!Number.isFinite(tasksToMove) || tasksToMove < 1) return null;
  if (!isValidWorkloadDeveloperName(from) || !isValidWorkloadDeveloperName(to)) return null;
  return { from, to, tasksToMove };
}

export function refineExplicitWorkloadRecommendation(rec, teamDevelopers, blockedDeveloperNames) {
  if (!rec || !isWorkloadCategory(rec) || !hasExplicitWorkloadMove(rec.text)) return rec;
  const parsed = parseExplicitWorkloadMove(rec.text);
  if (!parsed) return rec;
  const fromDev = findTeamDeveloper(teamDevelopers, parsed.from);
  const toDev = findTeamDeveloper(teamDevelopers, parsed.to);
  if (!fromDev || !toDev) return rec;
  if (isValidRedistributionPair(fromDev, toDev)) return rec;
  const replacement = pickRedistributionReceiver(teamDevelopers, parsed.from, blockedDeveloperNames);
  if (!replacement) return rec;
  const reasonMatch = String(rec.text).match(/:\s*(.+)$/);
  const reason =
    replacement !== parsed.to
      ? buildOpenLoadReason(parsed.from, replacement, teamDevelopers)
      : reasonMatch?.[1]?.trim() || buildOpenLoadReason(parsed.from, replacement, teamDevelopers);
  return {
    ...rec,
    text: formatWorkloadRecommendationText({
      from: parsed.from,
      to: replacement,
      tasksToMove: parsed.tasksToMove,
      reason,
    }),
  };
}

function mergeStructuredWorkloadRows(primaryRows, supplementalRows) {
  const out = [...primaryRows];
  const seenPairs = new Set(primaryRows.map((r) => movePairKey(r.from, r.to)));
  const seenFrom = new Set(primaryRows.map((r) => String(r.from).trim().toLowerCase()));

  for (const row of supplementalRows) {
    const fromKey = String(row.from).trim().toLowerCase();
    const pair = movePairKey(row.from, row.to);
    if (seenPairs.has(pair) || seenFrom.has(fromKey)) continue;
    out.push(row);
    seenPairs.add(pair);
    seenFrom.add(fromKey);
  }
  return out;
}

/** Best workload line from Gemini `actionableRecommendations` (unchanged wording). */
export function pickGeminiWorkloadFromActionables(actionables) {
  const workload = (actionables || []).filter(
    (r) => isWorkloadCategory(r) && typeof r?.text === 'string' && r.text.trim(),
  );
  const explicit = workload.find((r) => hasExplicitWorkloadMove(r.text));
  if (explicit) {
    return { category: 'workload_redistribution', text: explicit.text.trim(), kind: 'explicit' };
  }
  const generic = workload.find((r) => isGenericWorkloadRedistributionText(r.text));
  if (generic) {
    return { category: 'workload_redistribution', text: generic.text.trim(), kind: 'generic' };
  }
  return null;
}

function filterNonWorkloadActionables(actionables) {
  return (actionables || []).filter((rec) => {
    if (!rec || typeof rec.text !== 'string' || !rec.text.trim()) return false;
    return !isWorkloadCategory(rec);
  });
}

function pickSingleWorkloadRecommendation(structuredRows) {
  if (!structuredRows.length) return null;
  const sorted = [...structuredRows].sort((a, b) => Number(b.tasksToMove) - Number(a.tasksToMove));
  return toWorkloadRecommendationItem(sorted[0]);
}

function pickGenericBalancedWorkloadRecommendation(ins) {
  const fromPersisted = (ins?.actionableRecommendations ?? []).find(
    (r) =>
      isWorkloadCategory(r) &&
      typeof r.text === 'string' &&
      isGenericWorkloadRedistributionText(r.text),
  );
  if (fromPersisted?.text?.trim()) {
    return {
      category: 'workload_redistribution',
      text: fromPersisted.text.trim(),
    };
  }
  return {
    category: 'workload_redistribution',
    text: BALANCED_WORKLOAD_RECOMMENDATION_TEXT,
  };
}

/**
 * Merges recommendations: Gemini text first, structured API second, overload sync last.
 * @param {object|null} ins
 * @param {{ teamDevelopers?: Array<{ name?: string, assigned?: number, completed?: number, pending?: number, hours?: number }> }} [options]
 */
export function computeRecommendationList(ins, options = {}) {
  if (!ins) return [];

  const teamDevelopers = options.teamDevelopers ?? [];
  const blockedDevelopers = blockedDeveloperNamesFromInsights(ins);
  const rawActionables = ins.actionableRecommendations ?? [];
  const geminiWorkload = pickGeminiWorkloadFromActionables(rawActionables);
  const nonWorkloadActionables = filterNonWorkloadActionables(rawActionables);
  const teamOverload = hasTeamOverloadFlag(ins.developerInsights);

  const structuredFromApi = (ins.workloadRecommendations ?? [])
    .filter(
      (r) =>
        isValidWorkloadMoveRecommendation({
          from: r?.from,
          to: r?.to,
          tasksToMove: r?.tasksToMove,
        }) && !isBlockedDeveloperName(r?.to, blockedDevelopers),
    )
    .map((r) => ({
      from: String(r.from).trim(),
      to: String(r.to).trim(),
      tasksToMove: Number(r.tasksToMove),
      reason: typeof r.reason === 'string' ? r.reason : '',
    }));

  const geminiHasExplicitMove = geminiWorkload != null && geminiWorkload.kind === 'explicit';

  const structuredFromOverload = geminiHasExplicitMove
    ? []
    : workloadRowsFromDeveloperInsights(ins.developerInsights, teamDevelopers, blockedDevelopers);

  const structuredRows = refineStructuredWorkloadRows(
    mergeStructuredWorkloadRows(structuredFromApi, structuredFromOverload),
    teamDevelopers,
    blockedDevelopers,
  );

  let workloadItem = pickSingleWorkloadRecommendation(structuredRows);
  if (!workloadItem && geminiHasExplicitMove) {
    workloadItem = refineExplicitWorkloadRecommendation(
      geminiWorkload,
      teamDevelopers,
      blockedDevelopers,
    );
  }
  if (workloadItem && hasExplicitWorkloadMove(workloadItem.text)) {
    workloadItem = refineExplicitWorkloadRecommendation(
      workloadItem,
      teamDevelopers,
      blockedDevelopers,
    );
  }
  if (!workloadItem && teamOverload) {
    workloadItem = pickSingleWorkloadRecommendation(
      refineStructuredWorkloadRows(
        mergeStructuredWorkloadRows(
          structuredFromApi,
          workloadRowsFromDeveloperInsights(ins.developerInsights, teamDevelopers, blockedDevelopers),
        ),
        teamDevelopers,
        blockedDevelopers,
      ),
    );
  }
  if (!workloadItem && !teamOverload && geminiWorkload?.kind === 'generic') {
    workloadItem = geminiWorkload;
  }
  if (!workloadItem && !teamOverload) {
    workloadItem = pickGenericBalancedWorkloadRecommendation(ins);
  }

  const workloadItems = workloadItem ? [workloadItem] : [];

  const merged = [...nonWorkloadActionables, ...workloadItems];

  const seen = new Set();
  const out = [];
  let workloadKept = false;

  const onTimePercent = Number(options.onTimeDelivery);
  for (const rec of merged) {
    if (!rec || typeof rec.text !== 'string' || !rec.text.trim()) continue;
    if (
      Number.isFinite(onTimePercent) &&
      shouldDropOnTimeEstimationRecommendation(rec.text, onTimePercent)
    ) {
      continue;
    }
    if (isWorkloadCategory(rec)) {
      if (workloadKept) continue;
      const isExplicitMove = hasExplicitWorkloadMove(rec.text);
      const isAllowedGeneric = !teamOverload && isGenericWorkloadRedistributionText(rec.text);
      if (
        (!isExplicitMove && !isAllowedGeneric) ||
        /\bmove\s+~?\s*0\s+task/i.test(rec.text) ||
        /(?:\bto\s+|\bfrom\s+)(n\/?a|unknown|unassigned)\b/i.test(rec.text)
      ) {
        continue;
      }
      workloadKept = true;
    }
    const key = normalizeRecommendationKey(rec);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(rec);
  }
  return out;
}
