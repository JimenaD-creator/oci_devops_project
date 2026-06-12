import React, { useState, useMemo } from 'react';
import { Users, ChevronUp, ChevronDown, ChevronsUpDown, Search } from 'lucide-react';
import { useTheme } from '@mui/material/styles';
import { APP_FONT_FAMILY } from '../../theme';
import { developerAvatarColors } from '../../utils/developerColors';
import {
  collectDeveloperNamesForSelection,
  resolveProfilePictureFromRoster,
} from '../../utils/teamRosterUtils';
import { efficiencyScoreFromDeveloperHours } from './productivityScoreUtils';

const EFFICIENCY_COLUMN_LABEL = 'Efficiency Score';
const EFFICIENCY_COLUMN_HINT =
  'Estimated hours ÷ hours logged on assigned tasks (0–100%). 100% means on or ahead of estimates; below 100% means more time was logged than planned.';

const initialData = [
  {
    name: 'Developer 1',
    initials: 'D1',
    assigned: 8,
    completed: 6,
    hours: 32.5,
    estimatedHours: 30.0,
    onTime: 70,
    efficiencyScore: 100,
  },
  {
    name: 'Developer 2',
    initials: 'D2',
    assigned: 10,
    completed: 8,
    hours: 45.0,
    estimatedHours: 42.0,
    onTime: 85,
    efficiencyScore: 90,
  },
  {
    name: 'Developer 3',
    initials: 'D3',
    assigned: 6,
    completed: 5,
    hours: 20.0,
    estimatedHours: 24.0,
    onTime: 60,
    efficiencyScore: 80,
  },
  {
    name: 'Developer 4',
    initials: 'D4',
    assigned: 7,
    completed: 6,
    hours: 31.0,
    estimatedHours: 28.0,
    onTime: 75,
    efficiencyScore: 95,
  },
];

const rate = (completed, assigned) => Math.round((completed / assigned) * 100);
const avgHours = (hours, completed) => (hours / completed).toFixed(1);

function getBadgeClass(val, highThreshold, midThreshold, isDark) {
  if (val >= highThreshold) return isDark ? 'badge-tier-high-dark' : 'badge-tier-high';
  if (val >= midThreshold) return isDark ? 'badge-tier-mid-dark' : 'badge-tier-mid';
  return isDark ? 'badge-tier-low-dark' : 'badge-tier-low';
}

function Badge({ val, green, yellow }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return <span className={`badge-base ${getBadgeClass(val, green, yellow, isDark)}`}>{val}%</span>;
}

// ── Avatar con foto o iniciales ──────────────────────────────────────────────
function DevAvatar({ name, initials, profilePicture, avatarColors }) {
  if (profilePicture) {
    return (
      <div
        className="avatar-circle"
        style={{ background: avatarColors.bg, overflow: 'hidden', padding: 0 }}
      >
        <img
          src={profilePicture}
          alt={name}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center top',
            display: 'block',
          }}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>
    );
  }
  return (
    <div className="avatar-circle" style={{ background: avatarColors.bg }}>
      <span style={{ fontSize: '10px', fontWeight: 700, color: avatarColors.color }}>
        {initials}
      </span>
    </div>
  );
}

// Función para generar CSS dinámico según el tema
const getSharedDeveloperTableCSS = (isDark) => `
  .table-card {
    background: ${isDark ? '#1C1E22' : '#FFFFFF'}; border-radius: 12px; border: 1px solid ${isDark ? '#2A2C32' : '#1A1A1A'};
    box-shadow: 0 1px 4px rgba(0,0,0,0.04); overflow: hidden; margin-bottom: 24px;
    font-family: ${APP_FONT_FAMILY}; -webkit-font-smoothing: antialiased;
  }
  .table-header {
    padding: 20px; border-bottom: 1px solid ${isDark ? '#2A2C32' : '#F0F0F0'};
    display: flex; flex-direction: column; gap: 12px;
  }
  @media (min-width: 640px) {
    .table-header { flex-direction: row; align-items: center; justify-content: space-between; }
  }
  .table-header-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .table-title-icon-wrap {
    width: 36px; height: 36px; border-radius: 8px;
    background: ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,26,0.06)'};
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .table-title {
    font-family: ${APP_FONT_FAMILY}; font-size: 1.05rem; font-weight: 800;
    color: ${isDark ? '#F0F0F0' : '#1A1A1A'}; letter-spacing: -0.02em; margin: 0; line-height: 1.3;
  }
  .search-wrapper { position: relative; }
  .search-icon {
    position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
    color: ${isDark ? '#9A9A9A' : '#666'}; pointer-events: none;
  }
  .search-wrapper input.search-input[type="text"] {
    box-sizing: border-box; font-family: ${APP_FONT_FAMILY};
    padding: 8px 12px 8px 36px; font-size: 0.8125rem;
    border: 1px solid ${isDark ? '#2A2C32' : '#E5E5E5'}; border-radius: 8px; width: 200px;
    outline: none; color: ${isDark ? '#F0F0F0' : '#1A1A1A'}; background: ${isDark ? '#111214' : '#FAFAFA'};
  }
  .search-wrapper input.search-input[type="text"]::placeholder { color: ${isDark ? '#5A5A5A' : '#999'}; }
  .search-wrapper input.search-input[type="text"]:focus { border-color: #C74634; background: ${isDark ? '#1C1E22' : '#FFFFFF'}; }
  .table-scroll { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-family: ${APP_FONT_FAMILY}; }
  thead tr { background: ${isDark ? '#111214' : '#FAFAFA'}; }
  th {
    text-align: left; font-size: 0.75rem; font-weight: 700; color: ${isDark ? '#9A9A9A' : '#555'};
    padding: 12px 16px; white-space: nowrap; user-select: none; vertical-align: middle;
  }
  th.sortable { cursor: pointer; }
  th.sortable:hover { color: #C74634; }
  th.th-sprint-compare-group { text-align: center; vertical-align: bottom; color: ${isDark ? '#F0F0F0' : '#1A1A1A'}; font-size: 0.8125rem; }
  th.th-sprint-compare-group-bordered { border-left: 1px solid ${isDark ? '#2A2C32' : '#E8E8E8'}; }
  th.th-sprint-compare-sub-bordered { border-left: 1px solid ${isDark ? '#2A2C32' : '#E8E8E8'}; }
  .sprint-range-caption { display: block; font-size: 0.6875rem; color: ${isDark ? '#9A9A9A' : '#666'}; font-weight: 500; margin-top: 4px; }
  td { padding: 12px 16px; border-top: 1px solid ${isDark ? '#2A2C32' : '#F0F0F0'}; font-size: 0.875rem; color: ${isDark ? '#F0F0F0' : '#1A1A1A'}; }
  td.td-sprint-compare-first { border-left: 1px solid ${isDark ? '#2A2C32' : '#EFEFEF'}; }
  .row-odd { background: ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(250,250,250,0.85)'}; }
  tbody tr:hover { background: ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)'}; }
  .avatar-circle {
    width: 28px; height: 28px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .dev-name-text { font-size: 0.875rem; font-weight: 600; color: ${isDark ? '#F0F0F0' : '#1A1A1A'}; white-space: nowrap; }
  .cell-muted { color: ${isDark ? '#9A9A9A' : '#666'}; font-weight: 500; }
  .cell-strong { color: ${isDark ? '#F0F0F0' : '#1A1A1A'}; font-weight: 700; }
  .badge-base {
    display: inline-flex; align-items: center; padding: 2px 8px;
    border-radius: 9999px; font-size: 0.75rem; font-weight: 700; border: 1px solid;
    font-family: ${APP_FONT_FAMILY};
  }
  .badge-tier-high { color: #1B5E20; background: #E8F5E9; border-color: #A5D6A7; }
  .badge-tier-mid  { color: #E65100; background: #FFF3E0; border-color: #FFCC80; }
  .badge-tier-low  { color: #4A148C; background: #F3E5F5; border-color: #CE93D8; }
  .badge-tier-high-dark { color: #A5D6A7; background: #1A4A2A; border-color: #2E7D32; }
  .badge-tier-mid-dark  { color: #FFCC80; background: #4A2A1A; border-color: #E65100; }
  .badge-tier-low-dark  { color: #CE93D8; background: #2A1A3D; border-color: #7B1FA2; }
  .summary-row    { background: ${isDark ? '#16181C' : '#F7F7F7'}; border-top: 2px solid ${isDark ? '#2A2C32' : '#ECECEC'}; }
  .summary-cell   { font-size: 0.8125rem; font-weight: 700; color: ${isDark ? '#F0F0F0' : '#1A1A1A'}; }
  .text-center    { text-align: center; }
`;

const getSprintMetricsDashboardTextCSS = (isDark) => `
  .dev-productivity-dashboard .table-title         { font-size: 1.05rem; }
  .dev-productivity-dashboard .table-title-icon-wrap { width: 34px; height: 34px; }
  .dev-productivity-dashboard th                   { font-size: 0.8125rem; padding: 10px 12px; }
  .dev-productivity-dashboard th.th-sprint-compare-group { font-size: 0.875rem; }
  .dev-productivity-dashboard .sprint-range-caption { font-size: 0.7rem; margin-top: 4px; }
  .dev-productivity-dashboard td                   { font-size: 0.875rem; padding: 10px 12px; }
  .dev-productivity-dashboard .dev-name-text       { font-size: 0.875rem; }
  .dev-productivity-dashboard .badge-base          { font-size: 0.75rem; padding: 2px 7px; }
  .dev-productivity-dashboard .summary-cell        { font-size: 0.875rem; }
  .dev-productivity-dashboard .search-wrapper input.search-input[type="text"] {
    font-size: 0.8125rem; padding: 7px 10px 7px 32px;
  }
  .dev-productivity-dashboard .avatar-circle       { width: 28px; height: 28px; }
  .dev-productivity-dashboard .avatar-circle span  { font-size: 10px !important; }
  .dev-productivity-dashboard tr.row-highlight-you td {
    background: ${isDark ? 'rgba(199, 70, 52, 0.12)' : 'rgba(199, 70, 52, 0.06)'};
  }
  .dev-productivity-dashboard tr.row-highlight-you .dev-name-text {
    font-weight: 800;
    color: ${isDark ? '#F0F0F0' : '#1A1A1A'};
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

const fullColumns = [
  { key: 'name', label: 'Developer', sortable: true },
  { key: 'assigned', label: 'Tasks Assigned', sortable: true },
  { key: 'completed', label: 'Tasks Completed', sortable: true },
  { key: 'completionRate', label: 'Completion Rate', sortable: true },
  { key: 'hours', label: 'Total Hours', sortable: true },
  { key: 'estimatedHours', label: 'Estimated Hours', sortable: true },
  { key: 'avgHours', label: 'Average Hrs / Task', sortable: true },
  { key: 'onTime', label: 'On-Time Delivery', sortable: true },
  {
    key: 'efficiencyScore',
    label: EFFICIENCY_COLUMN_LABEL,
    sortable: true,
    hint: EFFICIENCY_COLUMN_HINT,
  },
];

function normalizeDeveloperName(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase();
}

function SprintMetricsTable({
  selectedSprints,
  compareMode,
  projectDevelopers = [],
  suppressCardTitle = false,
  filterDeveloperName = null,
  highlightDeveloperName = null,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: null, dir: 'asc' });

  const rows = useMemo(() => {
    let names = collectDeveloperNamesForSelection(selectedSprints, projectDevelopers);
    const filterName = String(filterDeveloperName ?? '').trim();
    if (filterName) {
      const target = normalizeDeveloperName(filterName);
      const matched = names.filter((n) => normalizeDeveloperName(n) === target);
      names = matched.length ? matched : [filterName];
    }
    return names.map((name) => {
      const row = { name };
      let initials = '';
      let profilePicture = null;
      let rosterUserId = null;
      selectedSprints.forEach((sp) => {
        const d = (sp.developers || []).find((x) => x.name === name);
        if (d) {
          if (!initials) initials = d.initials || initialsFromName(name);
          if (!profilePicture) profilePicture = d.profilePicture ?? null;
          if (d.userId != null && rosterUserId == null) rosterUserId = Number(d.userId);
        }
        row[`${sp.id}_assigned`] = d ? d.assigned : 0;
        row[`${sp.id}_completed`] = d ? d.completed : 0;
        row[`${sp.id}_hours`] = d ? d.hours : 0;
        row[`${sp.id}_estimatedHours`] = d ? Number(d.assignedHoursEstimate) || 0 : 0;
        const spHours = d ? Number(d.hours) || 0 : 0;
        row[`${sp.id}_onTime`] = d && typeof d.onTime === 'number' ? d.onTime : '—';
        const spEstimate = d ? Number(d.assignedHoursEstimate) || 0 : 0;
        row[`${sp.id}_efficiencyScore`] = d
          ? efficiencyScoreFromDeveloperHours(spHours, spEstimate)
          : null;
      });
      if (!profilePicture) {
        profilePicture = resolveProfilePictureFromRoster(projectDevelopers, {
          name,
          userId: rosterUserId,
        });
      }
      row.initials = initials || initialsFromName(name);
      row.profilePicture = profilePicture;
      return row;
    });
  }, [selectedSprints, projectDevelopers, filterDeveloperName]);

  const hideSearch = Boolean(String(filterDeveloperName ?? '').trim());
  const focusSingleDeveloper = hideSearch && !compareMode;
  const highlightName = String(highlightDeveloperName ?? '').trim();

  const isHighlightedRow = (rowName) => {
    if (!highlightName) return false;
    return normalizeDeveloperName(rowName) === normalizeDeveloperName(highlightName);
  };

  const filtered = useMemo(
    () =>
      hideSearch ? rows : rows.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())),
    [rows, search, hideSearch],
  );

  const sorted = useMemo(() => {
    if (!sort.key) {
      return [...filtered].sort((a, b) => {
        const totalA = selectedSprints.reduce(
          (acc, sp) => acc + (Number(a[`${sp.id}_completed`]) || 0),
          0,
        );
        const totalB = selectedSprints.reduce(
          (acc, sp) => acc + (Number(b[`${sp.id}_completed`]) || 0),
          0,
        );
        const diff = totalB - totalA;
        return diff !== 0 ? diff : String(a.name).localeCompare(String(b.name));
      });
    }
    return [...filtered].sort((a, b) => {
      const av = sortValue(a[sort.key]);
      const bv = sortValue(b[sort.key]);
      if (av !== null && bv !== null) return sort.dir === 'asc' ? av - bv : bv - av;
      if (sort.key === 'name')
        return sort.dir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      const as = String(a[sort.key] ?? '');
      const bs = String(b[sort.key] ?? '');
      return sort.dir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
    });
  }, [filtered, sort, selectedSprints]);

  const toggleSort = (key) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    );

  const avgForKey = (key) => {
    const nums = sorted.map((r) => r[key]).filter((v) => typeof v === 'number');
    if (!nums.length) return '—';
    const n = nums.reduce((acc, x) => acc + x, 0) / nums.length;
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  };

  const hoursAvgForSprint = (spId) => {
    const nums = sorted.map((r) => r[`${spId}_hours`]).filter((v) => typeof v === 'number');
    if (!nums.length) return '—';
    const n = nums.reduce((acc, x) => acc + x, 0) / nums.length;
    return `${Number.isInteger(n) ? n : n.toFixed(1)}h`;
  };

  const estimatedHoursAvgForSprint = (spId) => {
    const nums = sorted
      .map((r) => r[`${spId}_estimatedHours`])
      .filter((v) => typeof v === 'number');
    if (!nums.length) return '—';
    const n = nums.reduce((acc, x) => acc + x, 0) / nums.length;
    return `${Number.isInteger(n) ? n : n.toFixed(1)}h`;
  };

  const onTimeAvgForSprint = (spId) => {
    const nums = sorted.map((r) => r[`${spId}_onTime`]).filter((v) => typeof v === 'number');
    if (!nums.length) return null;
    return Math.round(nums.reduce((acc, x) => acc + x, 0) / nums.length);
  };

  const efficiencyAvgForSprint = (spId) => {
    const nums = sorted.map((r) => r[`${spId}_efficiencyScore`]).filter((v) => typeof v === 'number');
    if (!nums.length) return null;
    return Math.round(nums.reduce((acc, x) => acc + x, 0) / nums.length);
  };

  const renderHours = (v) => (typeof v === 'number' ? `${v}h` : v);
  const renderOnTimeCell = (v) =>
    typeof v === 'number' ? (
      <Badge val={v} green={90} yellow={70} />
    ) : (
      <span className="cell-muted">—</span>
    );
  const renderEfficiencyCell = (v) =>
    typeof v === 'number' ? (
      <Badge val={v} green={90} yellow={70} />
    ) : (
      <span className="cell-muted">—</span>
    );

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
      <style>{getSharedDeveloperTableCSS(isDark)}</style>
      <style>{getSprintMetricsDashboardTextCSS(isDark)}</style>
      <div className="table-card dev-productivity-dashboard">
        <div className="table-header">
          <div className="table-header-left">
            {!suppressCardTitle && (
              <>
                <div className="table-title-icon-wrap">
                  <Users size={22} color={isDark ? '#F0F0F0' : '#1A1A1A'} strokeWidth={2} />
                </div>
                <h3 className="table-title">Developer Productivity Breakdown</h3>
              </>
            )}
          </div>
          {!hideSearch ? (
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
          ) : null}
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              {compareMode ? (
                <>
                  <tr>
                    <th rowSpan={2} className="sortable" onClick={() => toggleSort('name')}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Developer {sortIcon('name')}
                      </div>
                    </th>
                    {selectedSprints.map((sp, si) => (
                      <th
                        key={sp.id}
                        colSpan={6}
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
                            Tasks Assigned {sortIcon(`${sp.id}_assigned`)}
                          </div>
                        </th>,
                        <th
                          key={`${sp.id}-d`}
                          className="sortable"
                          onClick={() => toggleSort(`${sp.id}_completed`)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            Tasks Completed {sortIcon(`${sp.id}_completed`)}
                          </div>
                        </th>,
                        <th
                          key={`${sp.id}-h`}
                          className="sortable"
                          onClick={() => toggleSort(`${sp.id}_hours`)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            Total Hours {sortIcon(`${sp.id}_hours`)}
                          </div>
                        </th>,
                        <th
                          key={`${sp.id}-eh`}
                          className="sortable"
                          onClick={() => toggleSort(`${sp.id}_estimatedHours`)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            Estimated Hours {sortIcon(`${sp.id}_estimatedHours`)}
                          </div>
                        </th>,
                        <th
                          key={`${sp.id}-ot`}
                          className="sortable"
                          onClick={() => toggleSort(`${sp.id}_onTime`)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            On-Time Delivery {sortIcon(`${sp.id}_onTime`)}
                          </div>
                        </th>,
                        <th
                          key={`${sp.id}-part`}
                          className="sortable"
                          title={EFFICIENCY_COLUMN_HINT}
                          onClick={() => toggleSort(`${sp.id}_efficiencyScore`)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {EFFICIENCY_COLUMN_LABEL} {sortIcon(`${sp.id}_efficiencyScore`)}
                          </div>
                        </th>,
                      ];
                    })}
                  </tr>
                </>
              ) : (
                <tr>
                  <th className="sortable" onClick={() => toggleSort('name')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Developer {sortIcon('name')}
                    </div>
                  </th>
                  {(() => {
                    const sp = selectedSprints[0];
                    return (
                      <>
                        <th className="sortable" onClick={() => toggleSort(`${sp.id}_assigned`)}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            Tasks Assigned {sortIcon(`${sp.id}_assigned`)}
                          </div>
                        </th>
                        <th className="sortable" onClick={() => toggleSort(`${sp.id}_completed`)}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            Tasks Completed {sortIcon(`${sp.id}_completed`)}
                          </div>
                        </th>
                        <th className="sortable" onClick={() => toggleSort(`${sp.id}_hours`)}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            Total Hours {sortIcon(`${sp.id}_hours`)}
                          </div>
                        </th>
                        <th
                          className="sortable"
                          onClick={() => toggleSort(`${sp.id}_estimatedHours`)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            Estimated Hours {sortIcon(`${sp.id}_estimatedHours`)}
                          </div>
                        </th>
                        {!focusSingleDeveloper ? (
                          <>
                            <th className="sortable" onClick={() => toggleSort(`${sp.id}_onTime`)}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                On-Time Delivery {sortIcon(`${sp.id}_onTime`)}
                              </div>
                            </th>
                            <th
                              className="sortable"
                              title={EFFICIENCY_COLUMN_HINT}
                              onClick={() => toggleSort(`${sp.id}_efficiencyScore`)}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {EFFICIENCY_COLUMN_LABEL} {sortIcon(`${sp.id}_efficiencyScore`)}
                              </div>
                            </th>
                          </>
                        ) : null}
                      </>
                    );
                  })()}
                </tr>
              )}
            </thead>
            <tbody>
              {sorted.map((r, i) => {
                const av = developerAvatarColors(r.name);
                const rowClass = [
                  i % 2 === 1 ? 'row-odd' : '',
                  isHighlightedRow(r.name) ? 'row-highlight-you' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <tr key={r.name} className={rowClass || undefined}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <DevAvatar
                          name={r.name}
                          initials={r.initials}
                          profilePicture={r.profilePicture}
                          avatarColors={av}
                        />
                        <span className="dev-name-text">
                          {r.name}
                          {isHighlightedRow(r.name) ? (
                            <span
                              style={{
                                marginLeft: 8,
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                color: '#C74634',
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                              }}
                            >
                              You
                            </span>
                          ) : null}
                        </span>
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
                            <td key={`${r.name}-${sp.id}-d`} className="text-center cell-strong">
                              {r[`${sp.id}_completed`]}
                            </td>,
                            <td key={`${r.name}-${sp.id}-h`} className="text-center cell-muted">
                              {renderHours(r[`${sp.id}_hours`])}
                            </td>,
                            <td key={`${r.name}-${sp.id}-eh`} className="text-center cell-muted">
                              {renderHours(r[`${sp.id}_estimatedHours`])}
                            </td>,
                            <td key={`${r.name}-${sp.id}-ot`} className="text-center">
                              {renderOnTimeCell(r[`${sp.id}_onTime`])}
                            </td>,
                            <td key={`${r.name}-${sp.id}-part`} className="text-center">
                              {renderEfficiencyCell(r[`${sp.id}_efficiencyScore`])}
                            </td>,
                          ];
                        })
                      : (() => {
                          const sp = selectedSprints[0];
                          return (
                            <>
                              <td className="text-center cell-muted">{r[`${sp.id}_assigned`]}</td>
                              <td className="text-center cell-strong">{r[`${sp.id}_completed`]}</td>
                              <td className="text-center cell-muted">
                                {renderHours(r[`${sp.id}_hours`])}
                              </td>
                              <td className="text-center cell-muted">
                                {renderHours(r[`${sp.id}_estimatedHours`])}
                              </td>
                              {!focusSingleDeveloper ? (
                                <>
                                  <td className="text-center">
                                    {renderOnTimeCell(r[`${sp.id}_onTime`])}
                                  </td>
                                  <td className="text-center">
                                    {renderEfficiencyCell(r[`${sp.id}_efficiencyScore`])}
                                  </td>
                                </>
                              ) : null}
                            </>
                          );
                        })()}
                  </tr>
                );
              })}
              {!focusSingleDeveloper ? (
              <tr className="summary-row">
                <td className="summary-cell">Team Average</td>
                {compareMode
                  ? selectedSprints.flatMap((sp, si) => {
                      const bc = si > 0 ? ' td-sprint-compare-first' : '';
                      const otAvg = onTimeAvgForSprint(sp.id);
                      const effAvg = efficiencyAvgForSprint(sp.id);
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
                        <td key={`avg-${sp.id}-eh`} className="summary-cell text-center">
                          {estimatedHoursAvgForSprint(sp.id)}
                        </td>,
                        <td key={`avg-${sp.id}-ot`} className="summary-cell text-center">
                          {otAvg != null ? (
                            <span className="summary-cell">{otAvg}%</span>
                          ) : (
                            <span className="cell-muted">—</span>
                          )}
                        </td>,
                        <td key={`avg-${sp.id}-part`} className="summary-cell text-center">
                          {effAvg != null ? (
                            <span className="summary-cell">{effAvg}%</span>
                          ) : (
                            <span className="cell-muted">—</span>
                          )}
                        </td>,
                      ];
                    })
                  : (() => {
                      const sp = selectedSprints[0];
                      const otAvg = onTimeAvgForSprint(sp.id);
                      const effAvg = efficiencyAvgForSprint(sp.id);
                      return (
                        <>
                          <td className="summary-cell text-center">
                            {avgForKey(`${sp.id}_assigned`)}
                          </td>
                          <td className="summary-cell text-center">
                            {avgForKey(`${sp.id}_completed`)}
                          </td>
                          <td className="summary-cell text-center">{hoursAvgForSprint(sp.id)}</td>
                          <td className="summary-cell text-center">
                            {estimatedHoursAvgForSprint(sp.id)}
                          </td>
                          <td className="summary-cell text-center">
                            {otAvg != null ? (
                              <span className="summary-cell">{otAvg}%</span>
                            ) : (
                              <span className="cell-muted">—</span>
                            )}
                          </td>
                          <td className="summary-cell text-center">
                            {effAvg != null ? (
                              <span className="summary-cell">{effAvg}%</span>
                            ) : (
                              <span className="cell-muted">—</span>
                            )}
                          </td>
                        </>
                      );
                    })()}
              </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function FullAnalyticsTable() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: null, dir: 'asc' });

  const enriched = useMemo(
    () =>
      initialData.map((r) => ({
        ...r,
        completionRate: rate(r.completed, r.assigned),
        avgHours: parseFloat(avgHours(r.hours, r.completed)),
      })),
    [],
  );

  const filtered = useMemo(
    () => enriched.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())),
    [enriched, search],
  );

  const sorted = useMemo(() => {
    if (!sort.key) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (typeof av === 'string')
        return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sort.dir === 'asc' ? av - bv : bv - av;
    });
  }, [filtered, sort]);

  const toggleSort = (key) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    );

  const avg = (key) => {
    const vals = enriched.map((r) => r[key]).filter((v) => typeof v === 'number');
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  };

  return (
    <>
      <style>{getSharedDeveloperTableCSS(isDark)}</style>
      <div className="table-card">
        <div className="table-header">
          <div className="table-header-left">
            <div className="table-title-icon-wrap">
              <Users size={20} color={isDark ? '#F0F0F0' : '#1A1A1A'} strokeWidth={2} />
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
                    title={col.hint}
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
                        <DevAvatar
                          name={r.name}
                          initials={r.initials}
                          profilePicture={r.profilePicture ?? null}
                          avatarColors={av}
                        />
                        <span className="dev-name-text">{r.name}</span>
                      </div>
                    </td>
                    <td className="text-center cell-muted">{r.assigned}</td>
                    <td className="text-center cell-strong">{r.completed}</td>
                    <td className="text-center">
                      <Badge val={r.completionRate} green={80} yellow={50} />
                    </td>
                    <td className="text-center cell-muted">{r.hours}h</td>
                    <td className="text-center cell-muted">{r.estimatedHours}h</td>
                    <td className="text-center cell-muted">{r.avgHours}h</td>
                    <td className="text-center">
                      <Badge val={r.onTime} green={90} yellow={70} />
                    </td>
                    <td className="text-center">
                      <Badge val={r.efficiencyScore} green={90} yellow={70} />
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
                <td className="summary-cell text-center">{avg('estimatedHours')}h</td>
                <td className="summary-cell text-center">{avg('avgHours')}h</td>
                <td className="text-center">
                  <span className="summary-cell">{avg('onTime')}%</span>
                </td>
                <td className="text-center">
                  <span className="summary-cell">{avg('efficiencyScore')}%</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export default function DeveloperTable({
  selectedSprints,
  compareMode,
  projectDevelopers = [],
  suppressCardTitle = false,
  filterDeveloperName = null,
  highlightDeveloperName = null,
}) {
  if (selectedSprints != null) {
    if (!selectedSprints.length) return null;
    return (
      <SprintMetricsTable
        selectedSprints={selectedSprints}
        compareMode={!!compareMode}
        projectDevelopers={projectDevelopers}
        suppressCardTitle={!!suppressCardTitle}
        filterDeveloperName={filterDeveloperName}
        highlightDeveloperName={highlightDeveloperName}
      />
    );
  }
  return <FullAnalyticsTable />;
}
