import { DataTable, PageHeader, Pagination } from "../components/ui.jsx";
import { useFetch } from "../hooks/useFetch.js";
import { clean, useQueryState } from "../hooks/useQueryState.js";
import { fmtDateTime } from "../lib/format.js";

const ENTITIES = ["registration", "certificate", "photo", "fort", "event", "announcement", "video", "testimonial", "faq", "page", "enquiry", "admin", "settings", "file"];

export default function AuditLogs() {
  const [f, setF] = useQueryState({ entity: "", action: "", limit: "50", page: "1" });
  const { data, loading, error } = useFetch("/admin/audit-logs", clean({ ...f }));
  const columns = [
    { key: "created_at", label: "When", render: (r) => <small>{fmtDateTime(r.created_at)}</small> },
    { key: "admin", label: "Who", render: (r) => <div className="cell-stack"><strong>{r.admin_name ?? "System"}</strong><small>{r.admin_email}</small></div> },
    { key: "action", label: "Action", render: (r) => <span className="mono">{r.action}</span> },
    { key: "entity", label: "Record", render: (r) => <span>{r.entity}{r.entity_id ? ` · ${r.entity_label ?? `#${r.entity_id}`}` : ""}</span> },
    { key: "meta", label: "Details", render: (r) => r.meta ? <code className="meta">{JSON.stringify(r.meta)}</code> : "—" },
    { key: "ip", label: "IP", render: (r) => <small className="mono">{r.ip_address}</small> },
  ];
  return (
    <>
      <PageHeader title="Audit log" crumbs={["System"]} subtitle="Every admin action, newest first." />
      <div className="toolbar">
        <select className="input" aria-label="Record type" value={f.entity} onChange={(e) => setF({ entity: e.target.value })}>
          <option value="">All records</option>
          {ENTITIES.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <input className="input" placeholder="Action (e.g. verify, login)" value={f.action} onChange={(e) => setF({ action: e.target.value.trim() })} aria-label="Action" />
      </div>
      <section className="panel panel--flush">
        <DataTable columns={columns} rows={data?.data} loading={loading} error={error} />
        <Pagination meta={data?.meta} onPage={(p) => setF({ page: String(p) })} onLimit={(l) => setF({ limit: String(l) })} limitOptions={[25, 50, 100]} />
      </section>
    </>
  );
}
