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
import { fmtDateTime, PARTICIPANT_TYPES, STATUS } from "../lib/format.js";

const DEFAULTS = { q: "", status: "", division_id: "", district_id: "", taluka_id: "", fort_id: "", from: "", to: "", duplicates: "", featured: "", trashed: "", sort: "newest", limit: "10", page: "1" };

export default function Registrations() {
  const { toast } = useUi();
  const [f, setF] = useQueryState(DEFAULTS);
  const [search, setSearch] = useState(f.q);
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
  const districts = f.division_id ? lookups.districts.filter((d) => String(d.division_id) === f.division_id) : [];
  const talukas = f.district_id ? (lookups.talukas ?? []).filter((t) => String(t.district_id) === f.district_id) : [];

  const columns = [
    { key: "photo", label: "", width: 64, render: (r) => r.thumb_path ? <img className="thumb" src={assetUrl(r.thumb_path)} alt="" loading="lazy" /> : <span className="thumb thumb--empty" /> },
    { key: "registration_no", label: "Reg. no", render: (r) => <span className="mono">{r.registration_no}</span> },
    { key: "name", label: "Participant", render: (r) => (
      <div className="cell-stack">
        <strong className="mr">{r.name}</strong>
        <small>{PARTICIPANT_TYPES[r.participant_type]}{r.organization_name ? ` · ${r.organization_name}` : ""}{r.members_count ? ` · ${r.members_count} members` : ""}</small>
      </div>
    ) },
    { key: "phone", label: "Mobile", render: (r) => <span className="mono">{r.phone}</span> },
    { key: "district", label: "District / fort", render: (r) => <div className="cell-stack mr"><span>{r.district ?? r.country}</span><small>{r.fort ?? "Other fort"}</small></div> },
    { key: "status", label: "Status", render: (r) => (
      <div className="cluster cluster--tight">
        <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
        {r.duplicate_of_photo_id && <span title="Photo matches an earlier submission"><AlertTriangle size={15} className="text-warning" aria-label="Duplicate photo" /></span>}
        {r.is_featured && <span title="Featured in gallery"><Star size={15} className="text-gold" aria-label="Featured" /></span>}
      </div>
    ) },
    { key: "created_at", label: "Submitted", render: (r) => <small>{fmtDateTime(r.created_at)}</small> },
  ];

  async function exportCsv() {
    try {
      await downloadFile("/admin/registrations/export.csv", clean({ ...f, page: undefined }), `durgotsav-${EDITION_YEAR}-registrations.csv`);
    } catch (err) {
      toast(apiError(err).message, "error");
    }
  }

  return (
    <>
      <PageHeader
        title="Registrations"
        crumbs={["Participation"]}
        subtitle="Every participant submission. Click a row to review, edit or verify."
        actions={<button type="button" className="btn btn--ghost" onClick={exportCsv}><Download size={16} /> Export CSV</button>}
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
        <select className="input" aria-label="Status" value={f.status} onChange={(e) => setF({ status: e.target.value })}>
          <option value="">All statuses</option>
          {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
        </select>
        <select className="input mr" aria-label="Division" value={f.division_id} onChange={(e) => setF({ division_id: e.target.value, district_id: "", taluka_id: "" })}>
          <option value="">All divisions</option>
          {(lookups.divisions ?? []).map((d) => <option key={d.id} value={d.id}>{d.name_mr}</option>)}
        </select>
        <select className="input mr" aria-label="District" value={f.district_id} disabled={!f.division_id} onChange={(e) => setF({ district_id: e.target.value, taluka_id: "" })}>
          <option value="">{f.division_id ? "All districts" : "Select division first"}</option>
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
        <select className="input" aria-label="Sort" value={f.sort} onChange={(e) => setF({ sort: e.target.value })}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>

      <section className="panel panel--flush">
        <DataTable columns={columns} rows={rows} loading={loading} error={error} onRowClick={(r) => setOpenId(r.id)} selection={f.trashed || !canBulk ? undefined : selection} empty="No registrations match these filters" />
        <Pagination meta={data?.meta} onPage={(p) => setF({ page: String(p) })} jump={false} />
      </section>

      {canBulk && <BulkBar selection={selection} photoIds={(ids) => rows.filter((r) => ids.includes(r.id) && r.photo_id).map((r) => r.photo_id)} onDone={reload} />}
      <RegistrationDrawer id={openId} lookups={lookups} onClose={() => setOpenId(null)} onChanged={reload} />
    </>
  );
}
