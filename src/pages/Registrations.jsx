import { AlertTriangle, Download, Search, Star, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { BulkBar } from "../components/BulkBar.jsx";
import { RegistrationDrawer } from "../components/RegistrationDrawer.jsx";
import { Badge, DataTable, PageHeader, Pagination, useSelection } from "../components/ui.jsx";
import { EDITION_YEAR } from "../config/edition.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useUi } from "../context/UiContext.jsx";
import { useDebounced, useFetch } from "../hooks/useFetch.js";
import { clean, useQueryState } from "../hooks/useQueryState.js";
import { apiError, assetUrl, downloadFile } from "../lib/api.js";
import { fmtDateTime, participantLine, STATUS } from "../lib/format.js";

const DEFAULTS = { q: "", status: "", division_id: "", district_id: "", taluka_id: "", fort_id: "", from: "", to: "", duplicates: "", featured: "", trashed: "", sort: "created_at", dir: "desc", limit: "10", page: "1" };
const SORTS = [
  ["created_at:desc", "Newest first"],
  ["created_at:asc", "Oldest first"],
  ["name:asc", "Name A–Z"],
  ["name:desc", "Name Z–A"],
  ["registration_no:asc", "Reg. no ↑"],
  ["registration_no:desc", "Reg. no ↓"],
  ["phone:asc", "Mobile ↑"],
  ["phone:desc", "Mobile ↓"],
  ["status:asc", "Status A–Z"],
  ["status:desc", "Status Z–A"],
];

export default function Registrations() {
  const { toast } = useUi();
  const [f, setF] = useQueryState(DEFAULTS);
  const [search, setSearch] = useState(f.q);
  const [exporting, setExporting] = useState(false);
  const q = useDebounced(search);
  const [openId, setOpenId] = useState(null);
  const selection = useSelection();
  const canBulk = useAuth().hasExplicitPermission("moderation_bulk");
  const lookups = useFetch("/admin/lookups").data?.data ?? { divisions: [], districts: [], talukas: [], forts: [] };

  useEffect(() => {
    if (q !== f.q) setF({ q });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  const params = clean({ ...f });
  const { data, loading, error, reload } = useFetch("/admin/registrations", params);
  const rows = data?.data ?? [];
  // District is the location the form asks for (SRS v2.1): every district is listed; a division narrows the list
  const districts = f.division_id ? lookups.districts.filter((d) => String(d.division_id) === f.division_id) : lookups.districts;
  const talukas = f.district_id ? (lookups.talukas ?? []).filter((t) => String(t.district_id) === f.district_id) : [];

  const columns = [
    { key: "photo", label: "", width: 64, render: (r) => r.thumb_path ? <img className="thumb" src={assetUrl(r.thumb_path)} alt="" loading="lazy" /> : <span className="thumb thumb--empty" /> },
    { key: "registration_no", sortKey: "registration_no", label: "Reg. no", render: (r) => <span className="mono">{r.registration_no}</span> },
    { key: "name", sortKey: "name", label: "Participant", render: (r) => (
      <div className="cell-stack">
        <strong className="mr">{r.name}</strong>
        {participantLine(r) && <small>{participantLine(r)}</small>}
      </div>
    ) },
    { key: "phone", sortKey: "phone", label: "Mobile", render: (r) => <span className="mono">{r.phone}</span> },
    // fort / taluka only on registrations made before the single-page form
    { key: "district", label: "District", render: (r) => <div className="cell-stack mr"><span>{r.district ?? r.country}</span>{r.fort && <small>{r.fort}</small>}</div> },
    { key: "certificate", label: "Certificate", render: (r) => (
      r.certificate_no
        ? <div className="cell-stack"><span className="mono">दुर्गवीर {r.durgveer_no}</span><small>{r.certificate_revoked_at ? "Withdrawn" : "Valid"}</small></div>
        : <small className="muted">—</small>
    ) },
    { key: "status", sortKey: "status", label: "Status", render: (r) => (
      <div className="cluster cluster--tight">
        <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
        {r.duplicate_of_photo_id && <span title="Photo matches an earlier submission"><AlertTriangle size={15} className="text-warning" aria-label="Duplicate photo" /></span>}
        {r.is_featured && <span title="Featured in gallery"><Star size={15} className="text-gold" aria-label="Featured" /></span>}
      </div>
    ) },
    { key: "created_at", sortKey: "created_at", sortFirst: "desc", label: "Submitted", render: (r) => <small>{fmtDateTime(r.created_at)}</small> },
  ];

  async function exportCsv() {
    setExporting(true);
    try {
      await downloadFile("/admin/registrations/export.csv", clean({ ...f, page: undefined }), `durgotsav-${EDITION_YEAR}-registrations.csv`);
    } catch (err) {
      toast(apiError(err).message, "error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Registrations"
        crumbs={["Participation"]}
        subtitle="Every participant submission. Click a row to review, edit or verify."
        actions={<button type="button" className="btn btn--ghost" onClick={exportCsv} disabled={exporting}><Download size={16} /> {exporting ? "Exporting…" : "Export CSV"}</button>}
      />

      <div className="resource-tabs">
        {[["", "All registrations"], ["duplicates", "Duplicates"], ["featured", "In gallery"], ["trashed", "Trash"]].map(([k, l]) => {
          const active = k ? f[k] === "true" : !(f.duplicates || f.featured || f.trashed);
          return (
            <button key={l} type="button" className={`resource-tab ${active ? "is-active" : ""}`}
              onClick={() => setF({ duplicates: "", featured: "", trashed: "", ...(k && { [k]: "true" }) })}>
              {k === "trashed" && <Trash2 size={13} />} {l}
            </button>
          );
        })}
      </div>

      <div className="toolbar">
        <label className="search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Search</span>
          <input className="input" placeholder="Name, mobile, email or reg. no" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        {/* Search matches 3 or more characters (or a whole registration number); shorter text finds nothing */}
        {search.trim().length > 0 && search.trim().length < 3 && <small className="field__hint">Type at least 3 characters, or a full registration number</small>}
        <select className="input" aria-label="Status" value={f.status} onChange={(e) => setF({ status: e.target.value })}>
          <option value="">All statuses</option>
          {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
        </select>
        <select className="input mr" aria-label="Division" value={f.division_id} onChange={(e) => setF({ division_id: e.target.value, district_id: "", taluka_id: "" })}>
          <option value="">All divisions</option>
          {(lookups.divisions ?? []).map((d) => <option key={d.id} value={d.id}>{d.name_mr}</option>)}
        </select>
        <select className="input mr" aria-label="District" value={f.district_id} onChange={(e) => setF({ district_id: e.target.value, taluka_id: "" })}>
          <option value="">All districts</option>
          {districts.map((d) => <option key={d.id} value={d.id}>{d.name_mr}</option>)}
        </select>
        <select className="input mr" aria-label="Taluka" value={f.taluka_id} disabled={!f.district_id} onChange={(e) => setF({ taluka_id: e.target.value })}>
          <option value="">{f.district_id ? "All talukas" : "Select district first"}</option>
          {talukas.map((t) => <option key={t.id} value={t.id}>{t.name_mr}</option>)}
        </select>
        <select className="input mr" aria-label="Fort" value={f.fort_id} onChange={(e) => setF({ fort_id: e.target.value })}>
          <option value="">All forts</option>
          {lookups.forts.map((x) => <option key={x.id} value={x.id}>{x.name_mr}</option>)}
        </select>
        <input className="input" type="date" aria-label="From date" value={f.from} onChange={(e) => setF({ from: e.target.value })} />
        <input className="input" type="date" aria-label="To date" value={f.to} onChange={(e) => setF({ to: e.target.value })} />
        <select className="input" aria-label="Sort" value={`${f.sort}:${f.dir}`} onChange={(e) => { const [sort, dir] = e.target.value.split(":"); setF({ sort, dir }); }}>
          {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <section className="panel panel--flush">
        <DataTable columns={columns} rows={rows} loading={loading} error={error} onRowClick={(r) => setOpenId(r.id)} selection={f.trashed || !canBulk ? undefined : selection} empty="No registrations match these filters"
          sort={{ key: f.sort, dir: f.dir, onSort: setF }} />
        <Pagination meta={data?.meta} onPage={(p) => setF({ page: String(p) })} jump={false} />
      </section>

      {canBulk && <BulkBar selection={selection} photoIds={(ids) => rows.filter((r) => ids.includes(r.id) && r.photo_id).map((r) => r.photo_id)} onDone={reload} />}
      <RegistrationDrawer id={openId} lookups={lookups} onClose={() => setOpenId(null)} onChanged={reload} />
    </>
  );
}
