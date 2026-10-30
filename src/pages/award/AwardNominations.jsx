import { Download, Eye, FileSpreadsheet, FileText, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Badge, DataTable, PageHeader, Pagination } from "../../components/ui.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useUi } from "../../context/UiContext.jsx";
import { useDebounced, useFetch } from "../../hooks/useFetch.js";
import { clean, useQueryState } from "../../hooks/useQueryState.js";
import { apiError, downloadFile } from "../../lib/api.js";
import { AWARD_BASE, AWARD_CATEGORY, AWARD_SECTION, AWARD_STATUS, optionLabel } from "../../lib/award.js";
import { fmtDateTime, fmtNumber } from "../../lib/format.js";

const MIN_SEARCH = 3;
const PAGE_SIZE = 10;

const DEFAULTS = { q: "", category: "", status: "", district_id: "", taluka_id: "", work_category: "", from: "", to: "", sort: "submitted_at", dir: "desc", page: "1" };
const SORTS = [
  ["submitted_at:desc", "Newest first"],
  ["submitted_at:asc", "Oldest first"],
  ["nominee_name:asc", "Nominee A–Z"],
  ["nominee_name:desc", "Nominee Z–A"],
  ["reference_no:asc", "Reference no. ↑"],
  ["reference_no:desc", "Reference no. ↓"],
  ["status:asc", "Status A–Z"],
  ["status:desc", "Status Z–A"],
  ["district:asc", "District A–Z"],
  ["district:desc", "District Z–A"],
];

export default function AwardNominations() {
  const navigate = useNavigate();
  const { toast } = useUi();
  const { hasPermission } = useAuth();
  const [f, setF] = useQueryState(DEFAULTS);
  const [search, setSearch] = useState(f.q);
  const q = useDebounced(search);
  const [exporting, setExporting] = useState(null);
  const lookups = useFetch("/admin/lookups").data?.data ?? { districts: [], talukas: [] };
  const options = useFetch("/admin/shivdurg-award/options").data?.data?.options;

  // The server ignores search text shorter than 3 characters (its trigram indexes need 3), so don't send it
  const tooShort = search.trim().length > 0 && search.trim().length < MIN_SEARCH;
  useEffect(() => {
    const next = q.trim().length >= MIN_SEARCH ? q.trim() : "";
    if (next !== f.q) setF({ q: next });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const { data, loading, error } = useFetch("/admin/shivdurg-award/nominations", clean({ ...f, limit: PAGE_SIZE }));
  const rows = data?.data ?? [];
  const meta = data?.meta;
  const talukas = f.district_id ? (lookups.talukas ?? []).filter((t) => String(t.district_id) === f.district_id) : [];
  const workOptions = f.category === "organization" ? options?.organization_work
    : f.category === "individual" ? options?.individual_work
      : [...(options?.individual_work ?? []), ...(options?.organization_work ?? []).filter((o) => !(options?.individual_work ?? []).some((i) => i.value === o.value))];
  const workLabel = (r, key) => optionLabel(r.category === "organization" ? options?.organization_work : options?.individual_work, key);
  const open = (r) => navigate(`${AWARD_BASE}/nominations/${r.id}`);

  // sortKey: only the sorts the server has indexes for (SORTS in award.service.js)
  const columns = [
    { key: "reference_no", sortKey: "reference_no", label: "Reference no.", render: (r) => <span className="mono">{r.reference_no}</span> },
    { key: "nominee_name", sortKey: "nominee_name", label: "Nominee / organization", render: (r) => (
      <div className="cell-stack"><strong className="mr">{r.nominee_name}</strong><small>{r.email}</small></div>
    ) },
    { key: "category", label: "Category", render: (r) => <Badge tone={r.category === "organization" ? "gold" : "info"}>{AWARD_CATEGORY[r.category].label}</Badge> },
    { key: "nominator", label: "Nominator", render: (r) => <div className="cell-stack"><span className="mr">{r.nominator_name}</span><small className="mono">{r.nominator_mobile}</small></div> },
    { key: "mobile", label: "Mobile", render: (r) => <span className="mono">{r.mobile}</span> },
    { key: "district", sortKey: "district", label: "District / taluka", render: (r) => <div className="cell-stack mr"><span>{r.district}</span><small>{r.taluka}</small></div> },
    { key: "work", label: "Work categories", render: (r) => (
      <div className="award-tags mr">
        {r.work_categories.slice(0, 2).map((k) => <span key={k} className="award-tag">{workLabel(r, k)}</span>)}
        {r.work_categories.length > 2 && <span className="award-tag award-tag--more" title={r.work_categories.slice(2).map((k) => workLabel(r, k)).join(", ")}>+{r.work_categories.length - 2}</span>}
      </div>
    ) },
    { key: "submitted_at", sortKey: "submitted_at", sortFirst: "desc", label: "Submitted", render: (r) => <small>{fmtDateTime(r.submitted_at)}</small> },
    { key: "status", sortKey: "status", label: "Status", render: (r) => <Badge tone={AWARD_STATUS[r.status].tone}>{AWARD_STATUS[r.status].label}</Badge> },
    { key: "_actions", label: "", width: 56, render: (r) => (
      <Link to={`${AWARD_BASE}/nominations/${r.id}`} className="icon-btn" aria-label={`View ${r.reference_no}`} title="View" onClick={(e) => e.stopPropagation()}><Eye size={16} /></Link>
    ) },
  ];

  async function exportAs(format) {
    setExporting(format);
    try {
      const params = clean({ ...f, page: undefined });
      await downloadFile(`/admin/shivdurg-award/nominations/export.${format}`, params, `shivdurg-bhushan-nominations.${format}`);
    } catch (err) {
      toast(apiError(err).message, "error");
    } finally {
      setExporting(null);
    }
  }
  const canExport = hasPermission("reports", "write");
  const [sortKey, sortDir] = [f.sort, f.dir];

  return (
    <>
      <PageHeader
        title="Nominations"
        crumbs={[AWARD_SECTION]}
        subtitle={data?.edition ? <span className="mr">{data.edition.title} · {fmtNumber(meta?.total ?? 0)}{meta?.capped ? "+" : ""} matching</span> : "Individual and organization nominations"}
        actions={canExport && (
          <div className="cluster cluster--tight">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => exportAs("xlsx")} disabled={Boolean(exporting)}><FileSpreadsheet size={15} /> Excel</button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => exportAs("csv")} disabled={Boolean(exporting)}><Download size={15} /> CSV</button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => exportAs("pdf")} disabled={Boolean(exporting)}><FileText size={15} /> PDF</button>
          </div>
        )}
      />

      <div className="resource-tabs">
        {[["", "All"], ["individual", "Individual"], ["organization", "Organization"]].map(([k, l]) => (
          <button key={l} type="button" className={`resource-tab ${f.category === k ? "is-active" : ""}`} onClick={() => setF({ category: k, work_category: "" })}>{l}</button>
        ))}
      </div>

      <div className="toolbar">
        <label className="search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Search</span>
          <input className="input" placeholder="Reference, name, mobile or email" value={search} onChange={(e) => setSearch(e.target.value)} />
          {tooShort && <small className="search__hint">Type at least {MIN_SEARCH} characters</small>}
        </label>
        <select className="input" aria-label="Status" value={f.status} onChange={(e) => setF({ status: e.target.value })}>
          <option value="">All statuses</option>
          {Object.entries(AWARD_STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
        </select>
        <select className="input mr" aria-label="District" value={f.district_id} onChange={(e) => setF({ district_id: e.target.value, taluka_id: "" })}>
          <option value="">All districts</option>
          {lookups.districts.map((d) => <option key={d.id} value={d.id}>{d.name_mr}</option>)}
        </select>
        <select className="input mr" aria-label="Taluka" value={f.taluka_id} disabled={!f.district_id} onChange={(e) => setF({ taluka_id: e.target.value })}>
          <option value="">{f.district_id ? "All talukas" : "Select district first"}</option>
          {talukas.map((t) => <option key={t.id} value={t.id}>{t.name_mr}</option>)}
        </select>
        <select className="input mr" aria-label="Work category" value={f.work_category} onChange={(e) => setF({ work_category: e.target.value })}>
          <option value="">All work categories</option>
          {(workOptions ?? []).map((o) => <option key={o.value} value={o.value}>{o.mr}</option>)}
        </select>
        <input className="input" type="date" aria-label="Submitted from" title="Submitted from" value={f.from} onChange={(e) => setF({ from: e.target.value })} />
        <input className="input" type="date" aria-label="Submitted to" title="Submitted to" value={f.to} onChange={(e) => setF({ to: e.target.value })} />
        <select className="input" aria-label="Sort" value={`${sortKey}:${sortDir}`} onChange={(e) => { const [sort, dir] = e.target.value.split(":"); setF({ sort, dir }); }}>
          {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <section className="panel panel--flush">
        <DataTable columns={columns} rows={rows} loading={loading} error={error} onRowClick={open}
          sort={{ key: f.sort, dir: f.dir, onSort: setF }}
          startIndex={meta ? (meta.page - 1) * meta.limit : 0} empty="No nominations match these filters" />
        <Pagination meta={meta} onPage={(p) => setF({ page: String(p) })} />
      </section>
    </>
  );
}
