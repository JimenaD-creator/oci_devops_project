import React, { useState, useMemo } from 'react';
import { Users, ChevronUp, ChevronDown, ChevronsUpDown, Search } from 'lucide-react';
import { APP_FONT_FAMILY } from '../../theme';
import { developerAvatarColors } from '../../utils/developerColors';

const initialData = [
  { name: 'Developer 1', initials: 'D1', assigned: 8, completed: 6, hours: 32.5, onTime: 70, participation: 100, workload: 80 },
  { name: 'Developer 2', initials: 'D2', assigned: 10, completed: 8, hours: 45.0, onTime: 85, participation: 90, workload: 100 },
  { name: 'Developer 3', initials: 'D3', assigned: 6, completed: 5, hours: 20.0, onTime: 60, participation: 80, workload: 60 },
  { name: 'Developer 4', initials: 'D4', assigned: 7, completed: 6, hours: 31.0, onTime: 75, participation: 95, workload: 70 },
];

const rate = (completed, assigned) => Math.round((completed / assigned) * 100);
const avgHours = (hours, completed) => (hours / completed).toFixed(1);

function getBadgeClass(val, highThreshold, midThreshold) {
  if (val >= highThreshold) return 'badge-tier-high';
  if (val >= midThreshold) return 'badge-tier-mid';
  return 'badge-tier-low';
}

function Badge({ val, green, yellow }) {
  return (
    <span className={`badge-base ${getBadgeClass(val, green, yellow)}`}>
      {val}%
    </span>
  );
}

function WorkloadBar({ val }) {
  return (
    <div className="workload-container">
      <div className="workload-track">
        <div className="workload-fill" style={{ width: `${val}%` }} />
      </div>
      <span className="workload-text">{val}%</span>
    </div>
  );
}

const fullColumns = [
  { key: 'name', label: 'Developer', sortable: true },
  { key: 'assigned', label: 'Tasks Assigned', sortable: true },
  { key: 'completed', label: 'Tasks Completed', sortable: true },
  { key: 'completionRate', label: 'Completion Rate', sortable: true },
  { key: 'hours', label: 'Total Hours', sortable: true },
  { key: 'avgHours', label: 'Average Hrs / Task', sortable: true },
  { key: 'onTime', label: 'On-Time Delivery', sortable: true },
  { key: 'participation', label: 'Participation Rate', sortable: true },
  { key: 'workload', label: 'Workload Balance', sortable: false },
];

/** Dashboard-aligned: DM Sans, #1A1A1A / #666 / Oracle red / soft borders. */
const SHARED_DEVELOPER_TABLE_CSS = `
          .table-card {
            background: #FFFFFF;
            border-radius: 12px;
            border: 1px solid #1A1A1A;
            box-shadow: 0 1px 4px rgba(0,0,0,0.04);
            overflow: hidden;
            margin-bottom: 24px;
            font-family: ${APP_FONT_FAMILY};
            -webkit-font-smoothing: antialiased;
          }
          .table-header {
            padding: 20px;
            border-bottom: 1px solid #F0F0F0;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          @media (min-width: 640px) {
            .table-header { flex-direction: row; align-items: center; justify-content: space-between; }
          }
          .table-header-left {
            display: flex;
            align-items: center;
            gap: 12px;
            min-width: 0;
          }
          .table-title-icon-wrap {
            width: 36px;
            height: 36px;
            border-radius: 8px;
            background: rgba(26, 26, 26, 0.06);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }
          .table-title {
            font-family: ${APP_FONT_FAMILY};
            font-size: 1.05rem;
            font-weight: 800;
            color: #1A1A1A;
            letter-spacing: -0.02em;
            margin: 0;
            line-height: 1.3;
          }
          .search-wrapper { position: relative; }
          .search-icon {
            position: absolute;
            left: 10px;
            top: 50%;
            transform: translateY(-50%);
            color: #666;
            pointer-events: none;
          }
          .search-wrapper input.search-input[type="text"] {
            box-sizing: border-box;
            font-family: ${APP_FONT_FAMILY};
            padding: 8px 12px 8px 36px;
            font-size: 0.8125rem;
            border: 1px solid #E5E5E5;
            border-radius: 8px;
            width: 200px;
            outline: none;
            color: #1A1A1A;
            background: #FAFAFA;
          }
          .search-wrapper input.search-input[type="text"]::placeholder { color: #999; }
          .search-wrapper input.search-input[type="text"]:focus {
            border-color: #C74634;
            background: #FFFFFF;
          }
          .export-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            font-family: ${APP_FONT_FAMILY};
            font-size: 0.8125rem;
            font-weight: 600;
            border: 1px solid #1A1A1A;
            color: #1A1A1A;
            background: transparent;
            border-radius: 8px;
            cursor: pointer;
            transition: background 0.2s;
          }
          .export-btn:hover { background: rgba(26, 26, 26, 0.06); }
          .table-scroll { overflow-x: auto; }
          table { width: 100%; border-collapse: collapse; font-family: ${APP_FONT_FAMILY}; }
          thead tr { background: #FAFAFA; }
          th {
            text-align: left;
            font-size: 0.75rem;
            font-weight: 700;
            color: #555;
            padding: 12px 16px;
            white-space: nowrap;
            user-select: none;
            vertical-align: middle;
          }
          th.sortable { cursor: pointer; }
          th.sortable:hover { color: #C74634; }
          th.th-sprint-compare-group {
            text-align: center;
            vertical-align: bottom;
            color: #1A1A1A;
            font-size: 0.8125rem;
          }
          th.th-sprint-compare-group-bordered { border-left: 1px solid #E8E8E8; }
          th.th-sprint-compare-sub-bordered { border-left: 1px solid #E8E8E8; }
          .sprint-range-caption {
            display: block;
            font-size: 0.6875rem;
            color: #666;
            font-weight: 500;
            margin-top: 4px;
          }
          td {
            padding: 12px 16px;
            border-top: 1px solid #F0F0F0;
            font-size: 0.875rem;
            color: #1A1A1A;
          }
          td.td-sprint-compare-first { border-left: 1px solid #EFEFEF; }
          .row-odd { background: rgba(250, 250, 250, 0.85); }
          tbody tr:hover { background: rgba(0, 0, 0, 0.03); }
          .avatar-circle {
            width: 28px; height: 28px; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
          }
          .dev-name-text {
            font-size: 0.875rem;
            font-weight: 600;
            color: #1A1A1A;
            white-space: nowrap;
          }
          .cell-muted { color: #666; font-weight: 500; }
          .cell-strong { color: #1A1A1A; font-weight: 700; }
          .badge-base {
            display: inline-flex;
            align-items: center;
            padding: 2px 8px;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 700;
            border: 1px solid;
            font-family: ${APP_FONT_FAMILY};
          }
          .badge-tier-high { color: #1B5E20; background: #E8F5E9; border-color: #A5D6A7; }
          .badge-tier-mid { color: #E65100; background: #FFF3E0; border-color: #FFCC80; }
          .badge-tier-low { color: #4A148C; background: #F3E5F5; border-color: #CE93D8; }
          .workload-container { display: flex; align-items: center; gap: 8px; }
          .workload-track { width: 96px; height: 8px; background: #F0F0F0; border-radius: 9999px; overflow: hidden; }
          .workload-fill { height: 100%; background: #607D8B; border-radius: 9999px; }
          .workload-text { font-size: 0.8125rem; font-weight: 600; color: #1A1A1A; }
          .summary-row { background: #F7F7F7; border-top: 2px solid #ECECEC; }
          .summary-cell { font-size: 0.8125rem; font-weight: 700; color: #1A1A1A; }
          .text-center { text-align: center; }
`;

/** Dashboard: “Developer Productivity Breakdown” (SprintMetricsTable) — texto más legible. */
const SPRINT_METRICS_DASHBOARD_TEXT_CSS = `
          .dev-productivity-dashboard .table-title {
            font-size: 1.2rem;
          }
          .dev-productivity-dashboard .table-title-icon-wrap {
            width: 40px;
            height: 40px;
          }
          .dev-productivity-dashboard th {
            font-size: 0.875rem;
            padding: 14px 16px;
          }
          .dev-productivity-dashboard th.th-sprint-compare-group {
            font-size: 0.9375rem;
          }
          .dev-productivity-dashboard .sprint-range-caption {
            font-size: 0.75rem;
            margin-top: 5px;
          }
          .dev-productivity-dashboard td {
            font-size: 1rem;
            padding: 14px 16px;
          }
          .dev-productivity-dashboard .dev-name-text {
            font-size: 1rem;
          }
          .dev-productivity-dashboard .badge-base {
            font-size: 0.8125rem;
            padding: 3px 9px;
          }
          .dev-productivity-dashboard .workload-text {
            font-size: 0.875rem;
          }
          .dev-productivity-dashboard .workload-track {
            width: 104px;
            height: 9px;
          }
          .dev-productivity-dashboard .summary-cell {
            font-size: 0.9375rem;
          }
          .dev-productivity-dashboard .search-wrapper input.search-input[type="text"] {
            font-size: 0.875rem;
            padding: 9px 12px 9px 36px;
          }
          .dev-productivity-dashboard .avatar-circle {
            width: 32px;
            height: 32px;
          }
          .dev-productivity-dashboard .avatar-circle span {
            font-size: 11px !important;
          }
`;

function initialsFromName(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function sortValue(v) {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  return null;
}

function SprintMetricsTable({ selectedSprints, compareMode, suppressCardTitle = false }) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: null, dir: 'asc' });

  const rows = useMemo(() => {
    const names = new Set();
    selectedSprints.forEach((sp) => (sp.developers || []).forEach((d) => names.add(d.name)));
    return Array.from(names).map((name) => {
      const row = { name };
      let initials = '';
      selectedSprints.forEach((sp) => {
        const d = (sp.developers || []).find((x) => x.name === name);
        if (d && !initials) initials = d.initials || initialsFromName(name);
        row[`${sp.id}_assigned`] = d ? d.assigned : '—';
        row[`${sp.id}_completed`] = d ? d.completed : '—';
        row[`${sp.id}_hours`] = d ? d.hours : '—';
        row[`${sp.id}_workload`] = d && typeof d.workload === 'number' ? d.workload : '—';
      });
      row.initials = initials || initialsFromName(name);
      return row;
    });
  }, [selectedSprints]);

  const filtered = useMemo(
    () => rows.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())),
    [rows, search]
  );

  const sorted = useMemo(() => {
    if (!sort.key) {
      return [...filtered].sort((a, b) => {
        const totalCompletedA = selectedSprints.reduce(
          (acc, sp) => acc + (Number(a[`${sp.id}_completed`]) || 0),
          0,
        );
        const totalCompletedB = selectedSprints.reduce(
          (acc, sp) => acc + (Number(b[`${sp.id}_completed`]) || 0),
          0,
        );
        const diff = totalCompletedB - totalCompletedA;
        if (diff !== 0) return diff;
        return String(a.name).localeCompare(String(b.name));
      });
    }
    return [...filtered].sort((a, b) => {
      const av = sortValue(a[sort.key]);
      const bv = sortValue(b[sort.key]);
      if (av !== null && bv !== null) return sort.dir === 'asc' ? av - bv : bv - av;
      if (sort.key === 'name') {
        return sort.dir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      }
      const as = String(a[sort.key] ?? '');
      const bs = String(b[sort.key] ?? '');
      return sort.dir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
    });
  }, [filtered, sort]);

  const toggleSort = (key) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  };

  const avgForKey = (key) => {
    const nums = sorted.map((r) => r[key]).filter((v) => typeof v === 'number');
    if (!nums.length) return '—';
    const n = nums.reduce((acc, x) => acc + x, 0) / nums.length;
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  };

  const hoursAvgForSprint = (spId) => {
    const key = `${spId}_hours`;
    const nums = sorted.map((r) => r[key]).filter((v) => typeof v === 'number');
    if (!nums.length) return '—';
    const n = nums.reduce((acc, x) => acc + x, 0) / nums.length;
    return `${Number.isInteger(n) ? n : n.toFixed(1)}h`;
  };

  const workloadAvgForSprint = (spId) => {
    const key = `${spId}_workload`;
    const nums = sorted.map((r) => r[key]).filter((v) => typeof v === 'number');
    if (!nums.length) return null;
    return Math.round(nums.reduce((acc, x) => acc + x, 0) / nums.length);
  };

  const renderHours = (v) => (typeof v === 'number' ? `${v}h` : v);

  const renderWorkloadCell = (v) =>
    typeof v === 'number' ? <WorkloadBar val={v} /> : <span className="cell-muted">—</span>;

  const sortIcon = (key) =>
    sort.key === key ? (
      sort.dir === 'asc' ? (
        <ChevronUp size={12} color="#C74634" />
      ) : (
        <ChevronDown size={12} color="#C74634" />
      )
    ) : (
      <ChevronsUpDown size={12} style={{ opacity: 0.4 }} />
    );

  return (
    <>
      <style>{SHARED_DEVELOPER_TABLE_CSS}</style>
      <style>{SPRINT_METRICS_DASHBOARD_TEXT_CSS}</style>

      <div className="table-card dev-productivity-dashboard">
        <div className="table-header">
          <div className="table-header-left">
            {!suppressCardTitle ? (
              <>
                <div className="table-title-icon-wrap">
                  <Users size={22} color="#1A1A1A" strokeWidth={2} />
                </div>
                <h3 className="table-title">Developer Productivity Breakdown</h3>
              </>
            ) : null}
          </div>
          <div className="search-wrapper">
            <Search className="search-icon" size={14} />
            <input
              type="text"
              placeholder="Search developer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              {compareMode ? (
                <>
                  <tr>
                    <th rowSpan={2} className="sortable" onClick={() => toggleSort('name')}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Developer
                        {sortIcon('name')}
                      </div>
                    </th>
                    {selectedSprints.map((sp, si) => (
                      <th
                        key={sp.id}
                        colSpan={4}
                        className={`th-sprint-compare-group${si > 0 ? ' th-sprint-compare-group-bordered' : ''}`}
                      >
                        {sp.shortLabel}
                        <span className="sprint-range-caption">{sp.dateRange}</span>
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {selectedSprints.flatMap((sp, si) => {
                      const b = si > 0 ? ' th-sprint-compare-sub-bordered' : '';
                      return [
                        <th
                          key={`${sp.id}-a`}
                          className={`sortable${b}`}
                          onClick={() => toggleSort(`${sp.id}_assigned`)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            Tasks Assigned
                            {sortIcon(`${sp.id}_assigned`)}
                          </div>
                        </th>,
                        <th
                          key={`${sp.id}-d`}
                          className="sortable"
                          onClick={() => toggleSort(`${sp.id}_completed`)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            Tasks Completed
                            {sortIcon(`${sp.id}_completed`)}
                          </div>
                        </th>,
                        <th
                          key={`${sp.id}-h`}
                          className="sortable"
                          onClick={() => toggleSort(`${sp.id}_hours`)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            Total Hours
                            {sortIcon(`${sp.id}_hours`)}
                          </div>
                        </th>,
                        <th key={`${sp.id}-w`}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>Workload Balance</div>
                        </th>,
                      ];
                    })}
                  </tr>
                </>
              ) : (
                <tr>
                  <th className="sortable" onClick={() => toggleSort('name')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Developer
                      {sortIcon('name')}
                    </div>
                  </th>
                  {(() => {
                    const sp = selectedSprints[0];
                    return (
                      <>
                        <th className="sortable" onClick={() => toggleSort(`${sp.id}_assigned`)}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            Tasks Assigned
                            {sortIcon(`${sp.id}_assigned`)}
                          </div>
                        </th>
                        <th className="sortable" onClick={() => toggleSort(`${sp.id}_completed`)}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            Tasks Completed
                            {sortIcon(`${sp.id}_completed`)}
                          </div>
                        </th>
                        <th className="sortable" onClick={() => toggleSort(`${sp.id}_hours`)}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            Total Hours
                            {sortIcon(`${sp.id}_hours`)}
                          </div>
                        </th>
                        <th>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>Workload Balance</div>
                        </th>
                      </>
                    );
                  })()}
                </tr>
              )}
            </thead>
            <tbody>
              {sorted.map((r, i) => {
                const av = developerAvatarColors(r.name);
                return (
                <tr key={r.name} className={i % 2 === 1 ? 'row-odd' : ''}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="avatar-circle" style={{ background: av.bg }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: av.color }}>{r.initials}</span>
                      </div>
                      <span className="dev-name-text">{r.name}</span>
                    </div>
                  </td>
                  {compareMode
                    ? selectedSprints.flatMap((sp, si) => {
                        const bc = si > 0 ? ' td-sprint-compare-first' : '';
                        return [
                          <td
                            key={`${r.name}-${sp.id}-a`}
                            className={`text-center cell-muted${bc}`}
                          >
                            {r[`${sp.id}_assigned`]}
                          </td>,
                          <td
                            key={`${r.name}-${sp.id}-d`}
                            className="text-center cell-strong"
                          >
                            {r[`${sp.id}_completed`]}
                          </td>,
                          <td key={`${r.name}-${sp.id}-h`} className="text-center cell-muted">
                            {renderHours(r[`${sp.id}_hours`])}
                          </td>,
                          <td key={`${r.name}-${sp.id}-w`}>{renderWorkloadCell(r[`${sp.id}_workload`])}</td>,
                        ];
                      })
                    : (() => {
                        const sp = selectedSprints[0];
                        return (
                          <>
                            <td className="text-center cell-muted">
                              {r[`${sp.id}_assigned`]}
                            </td>
                            <td className="text-center cell-strong">
                              {r[`${sp.id}_completed`]}
                            </td>
                            <td className="text-center cell-muted">
                              {renderHours(r[`${sp.id}_hours`])}
                            </td>
                            <td>{renderWorkloadCell(r[`${sp.id}_workload`])}</td>
                          </>
                        );
                      })()}
                </tr>
                );
              })}
              <tr className="summary-row">
                <td className="summary-cell">Team Average</td>
                {compareMode
                  ? selectedSprints.flatMap((sp, si) => {
                      const bc = si > 0 ? ' td-sprint-compare-first' : '';
                      const wAvg = workloadAvgForSprint(sp.id);
                      return [
                        <td key={`avg-${sp.id}-a`} className={`summary-cell text-center${bc}`}>
                          {avgForKey(`${sp.id}_assigned`)}
                        </td>,
                        <td key={`avg-${sp.id}-d`} className="summary-cell text-center">
                          {avgForKey(`${sp.id}_completed`)}
                        </td>,
                        <td key={`avg-${sp.id}-h`} className="summary-cell text-center">
                          {hoursAvgForSprint(sp.id)}
                        </td>,
                        <td key={`avg-${sp.id}-w`} className="summary-cell">
                          {wAvg != null ? <WorkloadBar val={wAvg} /> : <span className="cell-muted">—</span>}
                        </td>,
                      ];
                    })
                  : (() => {
                      const sp = selectedSprints[0];
                      const wAvg = workloadAvgForSprint(sp.id);
                      return (
                        <>
                          <td className="summary-cell text-center">{avgForKey(`${sp.id}_assigned`)}</td>
                          <td className="summary-cell text-center">{avgForKey(`${sp.id}_completed`)}</td>
                          <td className="summary-cell text-center">{hoursAvgForSprint(sp.id)}</td>
                          <td className="summary-cell">
                            {wAvg != null ? <WorkloadBar val={wAvg} /> : <span className="cell-muted">—</span>}
                          </td>
                        </>
                      );
                    })()}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function FullAnalyticsTable() {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: null, dir: 'asc' });

  const enriched = useMemo(
    () =>
      initialData.map((r) => ({
        ...r,
        completionRate: rate(r.completed, r.assigned),
        avgHours: parseFloat(avgHours(r.hours, r.completed)),
      })),
    []
  );

  const filtered = useMemo(
    () => enriched.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())),
    [enriched, search]
  );

  const sorted = useMemo(() => {
    if (!sort.key) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (typeof av === 'string') return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sort.dir === 'asc' ? av - bv : bv - av;
    });
  }, [filtered, sort]);

  const toggleSort = (key) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  };

  const avg = (key) => {
    const vals = enriched.map((r) => r[key]).filter((v) => typeof v === 'number');
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  };

  return (
    <>
      <style>{SHARED_DEVELOPER_TABLE_CSS}</style>

      <div className="table-card">
        <div className="table-header">
          <div className="table-header-left">
            <div className="table-title-icon-wrap">
              <Users size={20} color="#1A1A1A" strokeWidth={2} />
            </div>
            <h3 className="table-title">Developer Productivity Breakdown</h3>
          </div>
          <div className="search-wrapper">
            <Search className="search-icon" size={14} />
            <input
              type="text"
              placeholder="Search developer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {fullColumns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => col.sortable && toggleSort(col.key)}
                    className={col.sortable ? 'sortable' : ''}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {col.label}
                      {col.sortable &&
                        (sort.key === col.key ? (
                          sort.dir === 'asc' ? (
                            <ChevronUp size={12} color="#C74634" />
                          ) : (
                            <ChevronDown size={12} color="#C74634" />
                          )
                        ) : (
                          <ChevronsUpDown size={12} style={{ opacity: 0.4 }} />
                        ))}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => {
                const av = developerAvatarColors(r.name);
                return (
                <tr key={r.name} className={i % 2 === 1 ? 'row-odd' : ''}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="avatar-circle" style={{ background: av.bg }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: av.color }}>{r.initials}</span>
                      </div>
                      <span className="dev-name-text">{r.name}</span>
                    </div>
                  </td>
                  <td className="text-center cell-muted">
                    {r.assigned}
                  </td>
                  <td className="text-center cell-strong">
                    {r.completed}
                  </td>
                  <td className="text-center">
                    <Badge val={r.completionRate} green={80} yellow={50} />
                  </td>
                  <td className="text-center cell-muted">
                    {r.hours}h
                  </td>
                  <td className="text-center cell-muted">
                    {r.avgHours}h
                  </td>
                  <td className="text-center">
                    <Badge val={r.onTime} green={90} yellow={70} />
                  </td>
                  <td className="text-center">
                    <Badge val={r.participation} green={90} yellow={70} />
                  </td>
                  <td>
                    <WorkloadBar val={r.workload} />
                  </td>
                </tr>
                );
              })}

              <tr className="summary-row">
                <td className="summary-cell">Team Average</td>
                <td className="summary-cell text-center">{avg('assigned')}</td>
                <td className="summary-cell text-center">{avg('completed')}</td>
                <td className="text-center">
                  <span className="summary-cell">{avg('completionRate')}%</span>
                </td>
                <td className="summary-cell text-center">{avg('hours')}h</td>
                <td className="summary-cell text-center">{avg('avgHours')}h</td>
                <td className="text-center">
                  <span className="summary-cell">{avg('onTime')}%</span>
                </td>
                <td className="text-center">
                  <span className="summary-cell">{avg('participation')}%</span>
                </td>
                <td>
                  <WorkloadBar val={parseFloat(avg('workload'))} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/**
 * KPI Analytics: omit `selectedSprints` for the full table (demo data).
 * Dashboard: pass `selectedSprints` and `compareMode` for the same visual style plus sprint columns.
 */
export default function DeveloperTable({ selectedSprints, compareMode, suppressCardTitle = false }) {
  if (selectedSprints != null) {
    if (!selectedSprints.length) return null;
    return (
      <SprintMetricsTable
        selectedSprints={selectedSprints}
        compareMode={!!compareMode}
        suppressCardTitle={!!suppressCardTitle}
      />
    );
  }
  return <FullAnalyticsTable />;
}
