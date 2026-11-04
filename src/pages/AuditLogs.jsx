import { useEffect, useState } from "react";
import { DataTable, PageHeader, Pagination } from "../components/ui.jsx";
import { useDebounced, useFetch } from "../hooks/useFetch.js";
import { clean, useLastPage, useQueryState } from "../hooks/useQueryState.js";
import { fmtDateTime } from "../lib/format.js";

// Every record type the API writes to the log: its audit() calls and the `entity` of each createCrud table
const ENTITIES = [
  "registration", "certificate", "photo", "district_stats",
  "fort", "division", "district", "taluka", "event", "announcement", "video", "podcast", "testimonial", "faq", "page", "enquiry",
  "award_nomination", "award_document", "award_config", "award_committee_member", "award_winner",
  "admin", "role", "settings", "file",
];

// Rows per page; the server pages the list
const PAGE_SIZE = 10;

export default function AuditLogs() {
  const [f, setF] = useQueryState({ entity: "", action: "", from: "", to: "", sort: "created_at", dir: "desc", page: "1" });
  const [typed, setTyped] = useState(f.action);
  const action = useDebounced(typed.trim());
  useEffect(() => {
    if (action !== f.action) setF({ action });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action]);
  const { data, loading, error } = useFetch("/admin/audit-logs", clean({ ...f, limit: PAGE_SIZE }));
  useLastPage(data?.meta, (p) => setF({ page: String(p) }));
  const columns = [
    { key: "created_at", sortKey: "created_at", sortFirst: "desc", label: "When", render: (r) => <small>{fmtDateTime(r.created_at)}</small> },
    { key: "admin", label: "Who", render: (r) => <div className="cell-stack"><strong>{r.admin_name ?? "System"}</strong><small>{r.admin_email}</small></div> },
    { key: "action", sortKey: "action", label: "Action", render: (r) => <span className="mono">{r.action}</span> },
    { key: "entity", sortKey: "entity", label: "Record", render: (r) => <span>{r.entity}{r.entity_id ? ` · ${r.entity_label ?? `#${r.entity_id}`}` : ""}</span> },
    { key: "meta", label: "Details", render: (r) => r.meta ? <code className="meta">{JSON.stringify(r.meta)}</code> : "—" },
    { key: "ip", label: "IP", render: (r) => <small className="mono">{r.ip_address}</small> },
  ];
  return (
    <>
      <PageHeader title="Audit log" crumbs={["System"]} subtitle="Every admin action. Click a column header to sort; the dates reach back to older entries." />
      <div className="toolbar">
        <select className="input" aria-label="Record type" value={f.entity} onChange={(e) => setF({ entity: e.target.value })}>
          <option value="">All records</option>
          {ENTITIES.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <input className="input" placeholder="Action (e.g. verify, login)" value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Action" />
        <input className="input" type="date" aria-label="From date" title="From date" value={f.from} onChange={(e) => setF({ from: e.target.value })} />
        <input className="input" type="date" aria-label="To date" title="To date" value={f.to} onChange={(e) => setF({ to: e.target.value })} />
      </div>
      <section className="panel panel--flush">
        <DataTable columns={columns} rows={data?.data} loading={loading} error={error} sort={{ key: f.sort, dir: f.dir, onSort: setF }} meta={data?.meta} />
        <Pagination meta={data?.meta} onPage={(p) => setF({ page: String(p) })} />
      </section>
    </>
  );
}
