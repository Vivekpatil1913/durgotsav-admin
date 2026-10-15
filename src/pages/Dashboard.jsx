import {
  AlertTriangle, Award, CalendarDays, ChevronDown, ChevronUp,
  ChevronsUpDown, Clock, Copy, Images, Inbox, ShieldCheck, Upload,
  Users, Video, XCircle,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DataTable, HBarList, PageHeader, Pagination, StatCard } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useFetch } from "../hooks/useFetch.js";
import { fmtNumber, timeAgo } from "../lib/format.js";

// ---------------------------------------------------------------- RegionDonut
// Division share of registrations; click a division to drill into its districts.
// Colours follow the entity (sorted by id), never its rank, so a slice keeps its
// colour when counts change. Beyond 7 slices the rest fold into "Other".
const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
const OTHER_COLOR = "#b3a899";
const MAX_SLICES = 7;

function RegistrationWeeklyChart({ data }) {
  const weeks = [];
  for (let i = 0; i < data.length; i += 7) {
    const days = data.slice(i, i + 7);
    weeks.push({ start: days[0]?.day, end: days.at(-1)?.day, count: days.reduce((sum, day) => sum + day.count, 0) });
  }
  const max = Math.max(1, ...weeks.map((week) => week.count));
  const dateLabel = (value) => value
    ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00`))
    : "";

  return (
    <div className="registration-trend" role="img" aria-label="Registrations grouped by week for the last 30 days">
      <div className="registration-trend__rows">
        {weeks.map((week, index) => (
          <div className="registration-trend__row" key={week.start ?? index}>
            <span className="registration-trend__dates">{dateLabel(week.start)} – {dateLabel(week.end)}</span>
            <span className="registration-trend__track" aria-hidden="true">
              <span className="registration-trend__bar" style={{ width: `${week.count ? Math.max(3, (week.count / max) * 100) : 0}%` }} />
            </span>
            <strong className="registration-trend__count">{fmtNumber(week.count)}</strong>
          </div>
        ))}
      </div>
      <p className="registration-trend__key">Each bar shows registrations in that date range</p>
    </div>
  );
}

function toSlices(rows) {
  const colourById = new Map([...rows].sort((a, b) => a.id - b.id).map((r, i) => [r.id, SERIES[i % SERIES.length]]));
  const live = rows.filter((r) => r.total > 0).sort((a, b) => b.total - a.total);
  const head = live.slice(0, MAX_SLICES).map((r) => ({ ...r, color: colourById.get(r.id) }));
  const rest = live.slice(MAX_SLICES);
  if (rest.length) {
    head.push({ id: "other", name: `Other (${rest.length})`, total: rest.reduce((s, r) => s + r.total, 0), color: OTHER_COLOR, other: true });
  }
  return head;
}

function arcPath(cx, cy, r, ri, a0, a1) {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const p = (rad, a) => `${cx + rad * Math.sin(a)} ${cy - rad * Math.cos(a)}`;
  return `M ${p(r, a0)} A ${r} ${r} 0 ${large} 1 ${p(r, a1)} L ${p(ri, a1)} A ${ri} ${ri} 0 ${large} 0 ${p(ri, a0)} Z`;
}

function RegionDonut() {
  const [divisionId, setDivisionId] = useState(null);
  const [hover, setHover] = useState(null);
  const { data: divData } = useFetch("/admin/stats/divisions", { limit: 100 });
  const { data: distData } = useFetch("/admin/stats/districts", { limit: 100 });
  const divisions = divData?.data?.items;
  const districts = distData?.data?.items;

  const division = divisions?.find((d) => d.id === divisionId);
  const rows = division
    ? (districts ?? []).filter((d) => d.division_id === divisionId).map((d) => ({ id: d.id, name: d.district, total: d.total }))
    : (divisions ?? []).map((d) => ({ id: d.id, name: d.division, total: d.total }));
  const slices = toSlices(rows);
  const sum = slices.reduce((s, x) => s + x.total, 0);
  const loading = !divisions || (division && !districts);

  const size = 200, c = size / 2, r = 96, ri = 64;
  let angle = 0;
  const arcs = slices.map((sl) => {
    const a0 = angle;
    angle += (sl.total / sum) * Math.PI * 2;
    return { ...sl, a0, a1: angle };
  });
  const active = arcs.find((a) => a.id === hover);
  const pct = (n) => (sum ? ((n / sum) * 100).toFixed(1) : "0.0");
  const canDrill = (sl) => !division && !sl.other;
  const drill = (sl) => { if (canDrill(sl)) { setDivisionId(sl.id); setHover(null); } };
  const back = () => { setDivisionId(null); setHover(null); };

  return (
    <section className="panel">
      <header className="panel__head">
        <h2>Registrations by {division ? "district" : "division"}</h2>
        {division && <button type="button" className="donut__back" onClick={back}>← All divisions</button>}
      </header>
      {division && <p className="donut__crumb"><span className="mr">{division.division}</span> · {division.name_en}</p>}

      {loading ? (
        <div className="skeleton" style={{ height: 200 }} />
      ) : !sum ? (
        <p className="muted">No registrations yet</p>
      ) : (
        <div className="donut">
          <figure className="donut__figure">
            <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Registrations by ${division ? "district" : "division"}`}>
              {arcs.map((a) => {
                const hit = {
                  className: `donut__slice ${canDrill(a) ? "is-clickable" : ""} ${hover && a.id !== hover ? "is-dim" : ""}`,
                  onMouseEnter: () => setHover(a.id),
                  onMouseLeave: () => setHover(null),
                  onClick: () => drill(a),
                };
                // A single slice is a full ring; an SVG arc can't draw 360°.
                return arcs.length === 1
                  ? <circle key={a.id} cx={c} cy={c} r={(r + ri) / 2} fill="none" stroke={a.color} strokeWidth={r - ri} {...hit} />
                  : (
                    <path key={a.id} d={arcPath(c, c, a.id === hover ? r + 3 : r, ri, a.a0, a.a1)} fill={a.color} {...hit}>
                      <title>{`${a.name}: ${fmtNumber(a.total)} (${pct(a.total)}%)`}</title>
                    </path>
                  );
              })}
            </svg>
            <figcaption className="donut__center" aria-live="polite">
              <strong>{fmtNumber(active ? active.total : sum)}</strong>
              <span className="mr">{active ? active.name : "Total"}</span>
              {active && <small>{pct(active.total)}%</small>}
            </figcaption>
          </figure>

          <ul className="donut__legend">
            {arcs.map((a) => (
              <li key={a.id} className={hover && a.id !== hover ? "is-dim" : ""}>
                <button type="button" disabled={!canDrill(a)}
                  onMouseEnter={() => setHover(a.id)} onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(a.id)} onBlur={() => setHover(null)} onClick={() => drill(a)}
                  title={canDrill(a) ? "Show districts" : undefined}>
                  <span className="donut__swatch" style={{ background: a.color }} aria-hidden="true" />
                  <span className="donut__name mr">{a.name}</span>
                  <span className="donut__val">{fmtNumber(a.total)}</span>
                  <span className="donut__pct">{pct(a.total)}%</span>
                </button>
              </li>
            ))}
          </ul>
          {!division && <p className="donut__hint">Click a division to see its districts</p>}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- DivisionStatsPanel
const DIVISION_PAGE_SIZE = 10;

function DivisionStatsPanel() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const { data, loading, error } = useFetch("/admin/stats/divisions", { page, limit: DIVISION_PAGE_SIZE });
  const raw        = data?.data;
  const rows       = raw?.items ?? [];
  const meta       = raw?.meta ?? null;
  const total      = meta?.total      ?? rows.length;
  const totalPages = meta?.totalPages ?? 1;
  const grand      = rows.reduce((s, r) => s + (Number(r.total) || 0), 0);

  const columns = [
    {
      key: "division",
      label: "Division",
      render: (r) => <div className="cell-stack"><strong className="mr">{r.division}</strong><small>{r.name_en}</small></div>,
    },
    {
      key: "share",
      label: "Share",
      render: (r) => (
        <div className="share">
          <span className="share__track"><span style={{ width: `${grand ? (r.total / grand) * 100 : 0}%` }} /></span>
          <small>{grand ? ((r.total / grand) * 100).toFixed(1) : "0.0"}%</small>
        </div>
      ),
    },
    { key: "total",    label: "Registrations", render: (r) => <strong>{fmtNumber(r.total)}</strong> },
    { key: "verified", label: "Verified",      render: (r) => <span style={{ color: "var(--success)" }}>{fmtNumber(r.verified)}</span> },
    { key: "pending",  label: "Pending",       render: (r) => <span style={{ color: "var(--warning)" }}>{fmtNumber(r.pending)}</span> },
    { key: "rejected", label: "Rejected",      render: (r) => <span style={{ color: "var(--danger)" }}>{fmtNumber(r.rejected)}</span> },
  ];

  return (
    <section className="panel panel--flush" style={{ marginTop: 12 }}>
      <header className="panel__head" style={{ padding: "14px 18px 0" }}>
        <h2>
          Division-wise statistics
          {!loading && total > 0 && (
            <span className="badge" style={{ marginLeft: 8, verticalAlign: "middle" }}>
              {fmtNumber(total)} divisions
            </span>
          )}
        </h2>
      </header>
      {error && <div className="alert alert--error" style={{ margin: "12px 18px 0" }}>{error.message}</div>}
      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        onRowClick={(r) => navigate(`/registrations?division_id=${r.id}`)}
        empty="No division data available yet"
        rowKey={(r) => r.id ?? r.division}
        startIndex={(page - 1) * DIVISION_PAGE_SIZE}
      />
      {(total > 0 || page > 1) && (
        <Pagination
          meta={{ page, totalPages, total, limit: DIVISION_PAGE_SIZE }}
          onPage={setPage}
        />
      )}
    </section>
  );
}

// ---------------------------------------------------------------- DistrictStatsPanel
// Fetches all districts once (max 36 rows) then paginates client-side, 10 per page.
const DISTRICT_PAGE_SIZE = 10;

function DistrictStatsPanel() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  // Fetch all districts (≤36 in India) in one shot — paginated endpoint, request limit=50
  const { data, loading, error } = useFetch("/admin/stats/districts", { limit: 50 });
  const allRows = data?.data?.items ?? [];
  const grand   = allRows.reduce((s, r) => s + (Number(r.total) || 0), 0);

  // Client-side slice
  const total      = allRows.length;
  const totalPages = Math.max(1, Math.ceil(total / DISTRICT_PAGE_SIZE));
  const rows       = allRows.slice((page - 1) * DISTRICT_PAGE_SIZE, page * DISTRICT_PAGE_SIZE);

  const columns = [
    {
      key: "district",
      label: "District",
      render: (r) => <div className="cell-stack"><strong className="mr">{r.district}</strong><small>{r.name_en}</small></div>,
    },
    {
      key: "share",
      label: "Share",
      render: (r) => (
        <div className="share">
          <span className="share__track"><span style={{ width: `${grand ? (r.total / grand) * 100 : 0}%` }} /></span>
          <small>{grand ? ((r.total / grand) * 100).toFixed(1) : "0.0"}%</small>
        </div>
      ),
    },
    { key: "total",    label: "Registrations", render: (r) => <strong>{fmtNumber(r.total)}</strong> },
    { key: "verified", label: "Verified",      render: (r) => <span style={{ color: "var(--success)" }}>{fmtNumber(r.verified)}</span> },
    { key: "pending",  label: "Pending",       render: (r) => <span style={{ color: "var(--warning)" }}>{fmtNumber(r.pending)}</span> },
    { key: "rejected", label: "Rejected",      render: (r) => <span style={{ color: "var(--danger)" }}>{fmtNumber(r.rejected)}</span> },
  ];

  return (
    <section className="panel panel--flush" style={{ marginTop: 12 }}>
      <header className="panel__head" style={{ padding: "14px 18px 0" }}>
        <h2>
          District-wise statistics
          {!loading && total > 0 && (
            <span className="badge" style={{ marginLeft: 8, verticalAlign: "middle" }}>
              {fmtNumber(total)} districts
            </span>
          )}
        </h2>
        <Link to="/districts">Full view →</Link>
      </header>
      {error && <div className="alert alert--error" style={{ margin: "12px 18px 0" }}>{error.message}</div>}
      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        onRowClick={(r) => navigate(`/registrations?district_id=${r.id}`)}
        empty="No district data available yet"
        rowKey={(r) => r.id ?? r.district}
        startIndex={(page - 1) * DISTRICT_PAGE_SIZE}
      />
      {totalPages > 1 && (
        <Pagination
          meta={{ page, totalPages, total, limit: DISTRICT_PAGE_SIZE }}
          onPage={setPage}
        />
      )}
    </section>
  );
}

// ---------------------------------------------------------------- CityStatsPanel
// Server-side paginated city / taluka breakdown with district filter and sortable columns.
const CITY_LIMIT = 10;

function CityStatsPanel({ districtList }) {
  const [page,     setPage]     = useState(1);
  const [district, setDistrict] = useState("");
  const [sortKey,  setSortKey]  = useState("registrations");
  const [sortDir,  setSortDir]  = useState("desc");

  const params = {
    page,
    limit: CITY_LIMIT,
    sort: sortKey,
    dir: sortDir,
    ...(district ? { district } : {}),
  };
  const { data, loading, error } = useFetch("/admin/stats/cities", params);

  const raw        = data?.data;
  const rows       = raw?.items ?? [];
  const meta       = raw?.meta ?? null;
  const total      = meta?.total      ?? rows.length;
  const totalPages = meta?.totalPages ?? 1;

  function toggleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); setPage(1); }
  }

  // Inline sortable column header button
  function ThSort({ col, children }) {
    const active = sortKey === col;
    const Icon   = active ? (sortDir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
    return (
      <button
        type="button"
        style={{
          display: "inline-flex", alignItems: "center", gap: 3,
          background: "none", border: "none", padding: 0,
          font: "inherit", fontWeight: 600, fontSize: "inherit",
          cursor: "pointer", color: active ? "var(--brand)" : "inherit",
          letterSpacing: "0.04em", textTransform: "uppercase",
        }}
        onClick={() => toggleSort(col)}
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      >
        {children} <Icon size={11} />
      </button>
    );
  }

  const columns = [
    { key: "city",          label: <ThSort col="city">City / Taluka</ThSort>,          render: (r) => <strong>{r.city || "—"}</strong> },
    { key: "district",      label: "District",                                          render: (r) => <span className="mr">{r.district || "—"}</span> },
    { key: "registrations", label: <ThSort col="registrations">Registrations</ThSort>,  render: (r) => fmtNumber(r.registrations) },
    { key: "uploaded",      label: <ThSort col="uploaded">Uploaded</ThSort>,            render: (r) => fmtNumber(r.uploaded) },
    { key: "verified",      label: <ThSort col="verified">Verified</ThSort>,            render: (r) => <span style={{ color: "var(--success)" }}>{fmtNumber(r.verified)}</span> },
    { key: "pending",       label: "Pending",                                           render: (r) => <span style={{ color: "var(--warning)" }}>{fmtNumber(r.pending)}</span> },
    { key: "rejected",      label: "Rejected",                                          render: (r) => <span style={{ color: "var(--danger)" }}>{fmtNumber(r.rejected)}</span> },
    { key: "certificates",  label: <ThSort col="certificates">Certificates</ThSort>,    render: (r) => fmtNumber(r.certificates) },
  ];

  return (
    <section className="panel panel--flush" style={{ marginTop: 12 }}>
      <header className="panel__head" style={{ padding: "14px 18px 0", flexWrap: "wrap", gap: 8 }}>
        <h2>
          City-wise statistics
          {!loading && total > 0 && (
            <span className="badge" style={{ marginLeft: 8, verticalAlign: "middle" }}>
              {fmtNumber(total)} cities
            </span>
          )}
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <select
          className="input input--sm"
          style={{ width: "auto", minWidth: 170 }}
          value={district}
          onChange={(e) => { setDistrict(e.target.value); setPage(1); }}
          aria-label="Filter by district"
        >
          <option value="">All districts</option>
          {districtList.map((d) => (
            <option key={d.id ?? d.district} value={d.district}>
              {d.district}{d.name_en ? ` (${d.name_en})` : ""}
            </option>
          ))}
        </select>
        <Link to="/city-stats">Full view →</Link>
        </div>
      </header>
      {error && <div className="alert alert--error" style={{ margin: "12px 18px 0" }}>{error.message}</div>}
      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        empty="No city data available"
        rowKey={(r) => `${r.district ?? ""}__${r.city ?? ""}`}
        startIndex={(page - 1) * CITY_LIMIT}
      />
      {(total > 0 || page > 1) && (
        <Pagination
          meta={{ page, totalPages, total, limit: CITY_LIMIT }}
          onPage={setPage}
        />
      )}
    </section>
  );
}

// ---------------------------------------------------------------- Dashboard
export default function Dashboard() {
  const { admin } = useAuth();
  const navigate  = useNavigate();

  // Main dashboard stats
  const { data, loading, error } = useFetch("/admin/stats/dashboard");
  const d = data?.data;
  const t = d?.totals ?? {};
  const daily = d?.daily ?? [];

  // Districts list reused for the city filter dropdown (long-lived data, separate fetch)
  const { data: distData } = useFetch("/admin/stats/districts", { limit: 50 });
  const districtList = distData?.data?.items ?? [];

  return (
    <>
      <PageHeader
        title={`Welcome, ${admin.name.split(" ")[0]}`}
        subtitle="Live overview of Durgotsav 2026 participation."
        actions={
          <Link to="/moderation" className="btn btn--primary">
            <ShieldCheck size={16} /> Review photos {t.pending ? `(${fmtNumber(t.pending)})` : ""}
          </Link>
        }
      />
      {error && <div className="alert alert--error">{error.message}</div>}

      {t.pending_duplicates > 0 && (
        <div className="alert alert--warning">
          <AlertTriangle size={16} />
          {fmtNumber(t.pending_duplicates)} pending registration(s) reuse a photo already submitted.
          <Link to="/registrations?status=pending&duplicates=true">Review duplicates →</Link>
        </div>
      )}

      {/* ---- Stat cards ---- */}
      <section className="stat-grid" aria-busy={loading}>
        <StatCard
          label="Total registrations" icon={Users}
          value={t.registrations}
          hint={`${fmtNumber(t.today)} today`}
          onClick={() => navigate("/registrations")}
        />
        <StatCard
          label="Photos uploaded" icon={Upload}
          value={t.uploads ?? t.registrations}
          hint={`${fmtNumber((t.pending ?? 0) + (t.info_requested ?? 0))} awaiting review`}
          onClick={() => navigate("/moderation")}
        />
        <StatCard
          label="Awaiting review" icon={Clock} tone="warning"
          value={(t.pending ?? 0) + (t.info_requested ?? 0)}
          hint={`${fmtNumber(t.info_requested)} waiting on participant`}
          onClick={() => navigate("/moderation")}
        />
        <StatCard
          label="Verified participants" icon={ShieldCheck} tone="success"
          value={t.verified}
          onClick={() => navigate("/registrations?status=verified")}
        />
        <StatCard
          label="Certificates issued" icon={Award} tone="gold"
          value={t.certificates}
          hint={`${fmtNumber(t.certificates_emailed)} emailed`}
          onClick={() => navigate("/certificates")}
        />
        <StatCard
          label="Rejected" icon={XCircle} tone="danger"
          value={t.rejected}
          onClick={() => navigate("/registrations?status=rejected")}
        />
        <StatCard
          label="Duplicates" icon={Copy} tone="gold"
          value={t.duplicate}
          hint={`${fmtNumber(t.pending_duplicates)} auto-flagged in queue`}
          onClick={() => navigate("/moderation?status=duplicate")}
        />
        <StatCard
          label="Gallery photos" icon={Images}
          value={t.gallery_photos}
          onClick={() => navigate("/registrations?featured=true")}
        />
        <StatCard
          label="New enquiries" icon={Inbox}
          tone={t.new_enquiries ? "warning" : "brand"}
          value={t.new_enquiries}
          onClick={() => navigate("/content/enquiries")}
        />
      </section>

      {/* ---- Charts / quick panels ---- */}
      <div className="dash-grid">
        <section className="panel panel--span2 panel--chart">
          <header className="panel__head"><h2>Registrations by week · last 30 days</h2></header>
          {d
            ? <RegistrationWeeklyChart data={daily} />
            : <div className="skeleton" style={{ height: 180 }} />}
        </section>

        <RegionDonut />

        <section className="panel">
          <header className="panel__head"><h2>Top districts</h2><Link to="/districts">All →</Link></header>
          {d && <HBarList items={d.by_district.filter((x) => x.total > 0).map((x) => ({ name: x.district, count: x.total }))} />}
        </section>

        <section className="panel">
          <header className="panel__head"><h2>Replicas by fort</h2></header>
          {d && <HBarList items={d.by_fort} limit={12} />}
        </section>

        <section className="panel">
          <header className="panel__head"><h2>Recent activity</h2><Link to="/audit-logs">Audit log →</Link></header>
          <ul className="activity">
            {d?.recent_activity.map((a) => (
              <li key={a.id}>
                <span className="activity__dot" aria-hidden="true" />
                <span>
                  <strong>{a.admin_name ?? "System"}</strong>{" "}
                  {a.action.replace(/_/g, " ")} {a.entity}{a.entity_id ? ` #${a.entity_id}` : ""}
                </span>
                <time dateTime={a.created_at}>{timeAgo(a.created_at)}</time>
              </li>
            ))}
            {d && !d.recent_activity.length && <li className="muted">No activity yet</li>}
          </ul>
        </section>

      </div>

      {/* ---- Division-wise table ---- */}
      <DivisionStatsPanel />

      {/* ---- District-wise table ---- */}
      <DistrictStatsPanel />

      {/* ---- City-wise paginated table ---- */}
      <CityStatsPanel districtList={districtList} />
    </>
  );
}
