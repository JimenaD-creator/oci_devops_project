import React, { useState, useMemo } from 'react';
import { Users, ChevronUp, ChevronDown, ChevronsUpDown, Search } from 'lucide-react';

const initialData = [
  { name: 'Carlos Ruiz', initials: 'CR', assigned: 8, completed: 6, hours: 32.5, onTime: 70, participation: 100, workload: 80 },
  { name: 'María García', initials: 'MG', assigned: 10, completed: 8, hours: 45.0, onTime: 85, participation: 90, workload: 100 },
  { name: 'Juan Pérez', initials: 'JP', assigned: 6, completed: 5, hours: 20.0, onTime: 60, participation: 80, workload: 60 },
  { name: 'Laura Sánchez', initials: 'LS', assigned: 7, completed: 6, hours: 31.0, onTime: 75, participation: 95, workload: 70 },
];

const rate = (completed, assigned) => Math.round((completed / assigned) * 100);
const avgHours = (hours, completed) => (hours / completed).toFixed(1);

function getBadgeClass(val, greenThreshold, yellowThreshold) {
  if (val >= greenThreshold) return 'badge-green';
  if (val >= yellowThreshold) return 'badge-yellow';
  return 'badge-red';
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

/** Same look as KPI analytics table (colors, typography, workload bar). */
const SHARED_DEVELOPER_TABLE_CSS = `
          .table-card {
            background: white;
            border-radius: 12px;
            border: 1px solid #f3f4f6;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
            overflow: hidden;
            margin-bottom: 24px;
            font-family: sans-serif;
          }
          .table-header {
            padding: 20px;
            border-bottom: 1px solid #f9fafb;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          @media (min-width: 640px) {
            .table-header { flex-direction: row; align-items: center; justify-content: space-between; }
          }
          .search-wrapper { position: relative; }
          .search-icon {
            position: absolute;
            left: 10px;
            top: 50%;
            transform: translateY(-50%);
            color: #6F6F6F;
            pointer-events: none;
          }
          .search-wrapper input.search-input[type="text"] {
            box-sizing: border-box;
            padding: 6px 12px 6px 36px;
            font-size: 12px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            width: 176px;
            outline: none;
          }
          .search-wrapper input.search-input[type="text"]:focus { border-color: #C74634; }
          .export-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            font-size: 12px;
            font-weight: 600;
            border: 1px solid #C74634;
            color: #C74634;
            background: transparent;
            border-radius: 8px;
            cursor: pointer;
            transition: background 0.2s;
          }
          .export-btn:hover { background: rgba(199, 70, 52, 0.05); }
          .table-scroll { overflow-x: auto; }
          table { width: 100%; border-collapse: collapse; }
          thead tr { background: #F5F5F5; }
          th {
            text-align: left;
            font-size: 12px;
            font-weight: 600;
            color: #6F6F6F;
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
          }
          th.th-sprint-compare-group-bordered { border-left: 1px solid #e5e7eb; }
          th.th-sprint-compare-sub-bordered { border-left: 1px solid #e5e7eb; }
          .sprint-range-caption {
            display: block;
            font-size: 10px;
            color: #888;
            font-weight: 500;
            margin-top: 2px;
          }
          td { padding: 14px 16px; border-top: 1px solid #f9fafb; }
          td.td-sprint-compare-first { border-left: 1px solid #f3f4f6; }
          .row-odd { background: rgba(249, 250, 251, 0.3); }
          tr:hover { background: rgba(249, 250, 251, 0.6); }
          .avatar-circle {
            width: 28px; height: 28px; border-radius: 50%;
            background: rgba(199, 70, 52, 0.1);
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
          }
          .badge-base {
            display: inline-flex;
            align-items: center;
            padding: 2px 8px;
            border-radius: 9999px;
            font-size: 12px;
            font-weight: 700;
            border: 1px solid;
          }
          .badge-green { color: #16a34a; background: #f0fdf4; border-color: #bbf7d0; }
          .badge-yellow { color: #ca8a04; background: #fefce8; border-color: #fef08a; }
          .badge-red { color: #dc2626; background: #fef2f2; border-color: #fecaca; }
          .workload-container { display: flex; align-items: center; gap: 8px; }
          .workload-track { width: 96px; height: 8px; background: #f3f4f6; border-radius: 9999px; overflow: hidden; }
          .workload-fill { height: 100%; background: #C74634; border-radius: 9999px; }
          .workload-text { font-size: 12px; font-weight: 600; color: #2E2E2E; }
          .summary-row { background: rgba(243, 244, 246, 0.8); border-top: 2px solid #e5e7eb; }
          .summary-cell { font-size: 12px; font-weight: 700; color: #4A4A4A; }
          .text-center { text-align: center; }
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

function SprintMetricsTable({ selectedSprints, compareMode }) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: null, dir: 'asc' });

  const rows = useMemo(() => {
    const names = new Set();
    selectedSprints.forEach((sp) => sp.developers.forEach((d) => names.add(d.name)));
    return Array.from(names).map((name) => {
      const row = { name };
      let initials = '';
      selectedSprints.forEach((sp) => {
        const d = sp.developers.find((x) => x.name === name);
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
    if (!sort.key) return filtered;
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
    typeof v === 'number' ? <WorkloadBar val={v} /> : <span style={{ fontSize: '14px', color: '#4A4A4A' }}>—</span>;

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

      <div className="table-card">
        <div className="table-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={20} color="#C74634" />
            <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#2E2E2E', margin: 0 }}>
              Developer Productivity Breakdown
            </h3>
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
              {sorted.map((r, i) => (
                <tr key={r.name} className={i % 2 === 1 ? 'row-odd' : ''}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="avatar-circle">
                        <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#C74634' }}>{r.initials}</span>
                      </div>
                      <span style={{ fontSize: '14px', fontWeight: '500', color: '#2E2E2E', whiteSpace: 'nowrap' }}>
                        {r.name}
                      </span>
                    </div>
                  </td>
                  {compareMode
                    ? selectedSprints.flatMap((sp, si) => {
                        const bc = si > 0 ? ' td-sprint-compare-first' : '';
                        return [
                          <td
                            key={`${r.name}-${sp.id}-a`}
                            className={`text-center${bc}`}
                            style={{ fontSize: '14px', color: '#4A4A4A' }}
                          >
                            {r[`${sp.id}_assigned`]}
                          </td>,
                          <td
                            key={`${r.name}-${sp.id}-d`}
                            className="text-center"
                            style={{ fontSize: '14px', fontWeight: '600', color: '#2E2E2E' }}
                          >
                            {r[`${sp.id}_completed`]}
                          </td>,
                          <td key={`${r.name}-${sp.id}-h`} className="text-center" style={{ fontSize: '14px', color: '#4A4A4A' }}>
                            {renderHours(r[`${sp.id}_hours`])}
                          </td>,
                          <td key={`${r.name}-${sp.id}-w`}>{renderWorkloadCell(r[`${sp.id}_workload`])}</td>,
                        ];
                      })
                    : (() => {
                        const sp = selectedSprints[0];
                        return (
                          <>
                            <td className="text-center" style={{ fontSize: '14px', color: '#4A4A4A' }}>
                              {r[`${sp.id}_assigned`]}
                            </td>
                            <td className="text-center" style={{ fontSize: '14px', fontWeight: '600', color: '#2E2E2E' }}>
                              {r[`${sp.id}_completed`]}
                            </td>
                            <td className="text-center" style={{ fontSize: '14px', color: '#4A4A4A' }}>
                              {renderHours(r[`${sp.id}_hours`])}
                            </td>
                            <td>{renderWorkloadCell(r[`${sp.id}_workload`])}</td>
                          </>
                        );
                      })()}
                </tr>
              ))}
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
                          {wAvg != null ? <WorkloadBar val={wAvg} /> : '—'}
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
                            {wAvg != null ? <WorkloadBar val={wAvg} /> : '—'}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={20} color="#C74634" />
            <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#2E2E2E', margin: 0 }}>
              Developer Productivity Breakdown
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
              {sorted.map((r, i) => (
                <tr key={r.name} className={i % 2 === 1 ? 'row-odd' : ''}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="avatar-circle">
                        <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#C74634' }}>{r.initials}</span>
                      </div>
                      <span style={{ fontSize: '14px', fontWeight: '500', color: '#2E2E2E', whiteSpace: 'nowrap' }}>
                        {r.name}
                      </span>
                    </div>
                  </td>
                  <td className="text-center" style={{ fontSize: '14px', color: '#4A4A4A' }}>
                    {r.assigned}
                  </td>
                  <td className="text-center" style={{ fontSize: '14px', fontWeight: '600', color: '#2E2E2E' }}>
                    {r.completed}
                  </td>
                  <td className="text-center">
                    <Badge val={r.completionRate} green={80} yellow={50} />
                  </td>
                  <td className="text-center" style={{ fontSize: '14px', color: '#4A4A4A' }}>
                    {r.hours}h
                  </td>
                  <td className="text-center" style={{ fontSize: '14px', color: '#4A4A4A' }}>
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
              ))}

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
export default function DeveloperTable({ selectedSprints, compareMode }) {
  if (selectedSprints != null) {
    if (!selectedSprints.length) return null;
    return <SprintMetricsTable selectedSprints={selectedSprints} compareMode={!!compareMode} />;
  }
  return <FullAnalyticsTable />;
}
