import {
  AlertTriangle, Award, CalendarDays, ChevronDown, ChevronUp,
  ChevronsUpDown, Clock, Copy, Images, Inbox, Map, ShieldCheck, Upload,
  Users, Video, XCircle,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BarChart, DataTable, HBarList, PageHeader, Pagination, StatCard } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useFetch } from "../hooks/useFetch.js";
import { fmtNumber, PARTICIPANT_TYPES, timeAgo } from "../lib/format.js";

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
        <section className="panel panel--span2">
          <header className="panel__head"><h2>Registrations · last 30 days</h2></header>
          {d
            ? <BarChart data={d.daily} label="Registrations per day for the last 30 days" />
            : <div className="skeleton" style={{ height: 180 }} />}
        </section>

        <section className="panel">
          <header className="panel__head"><h2>By participant type</h2></header>
          {d && (d.by_type.length
            ? <HBarList items={d.by_type.map((x) => ({ name: PARTICIPANT_TYPES[x.type] ?? x.type, count: x.count }))} />
            : <p className="muted">No data yet</p>)}
        </section>

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
