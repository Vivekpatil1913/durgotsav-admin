import { Ban, Download, Mail, RotateCcw, Search, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge, DataTable, PageHeader, Pagination } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useUi } from "../context/UiContext.jsx";
import { useDebounced, useFetch } from "../hooks/useFetch.js";
import { clean, useQueryState } from "../hooks/useQueryState.js";
import { api, apiError, downloadFile } from "../lib/api.js";
import { fmtDateTime } from "../lib/format.js";

export default function Certificates() {
  const { can } = useAuth();
  const { toast, confirm } = useUi();
  const [f, setF] = useQueryState({ q: "", state: "", emailed: "", page: "1" });
  const [search, setSearch] = useState(f.q);
  const q = useDebounced(search);
  useEffect(() => {
    if (q !== f.q) setF({ q });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  const { data, loading, error, reload } = useFetch("/admin/certificates", clean({ ...f, limit: 25 }));

  const act = async (fn, ok) => {
    try {
      await fn();
      toast(ok);
      reload();
    } catch (err) {
      toast(apiError(err).message, "error");
    }
  };

  async function revoke(c) {
    const reason = window.prompt(`Reason for revoking ${c.certificate_no}? (PDF §7.7)`);
    if (!reason?.trim()) return;
    act(() => api.post(`/admin/certificates/${c.registration_id}/revoke`, { reason: reason.trim() }), "Certificate revoked");
  }

  async function sendPending() {
    if (!(await confirm({ title: "Email all pending certificates?", message: "Every verified participant with an email who has not yet received their certificate will be emailed.", confirmLabel: "Send emails", tone: "primary" }))) return;
    act(async () => {
      const { data: res } = await api.post("/admin/certificates/send-pending");
      toast(`${res.data.queued} email(s) queued`, "info");
    }, "Sending in the background");
  }

  const columns = [
    { key: "certificate_no", label: "Certificate", render: (c) => <span className="mono">{c.certificate_no}</span> },
    { key: "name", label: "Participant", render: (c) => <div className="cell-stack"><strong className="mr">{c.name}</strong><small className="mono">{c.registration_no} · {c.phone}</small></div> },
    { key: "district", label: "District", render: (c) => <span className="mr">{c.district ?? "—"}</span> },
    { key: "issued_at", label: "Issued", render: (c) => <small>{fmtDateTime(c.issued_at)}</small> },
    { key: "delivery", label: "Delivery", render: (c) => (
      <div className="cell-stack">
        <small>{c.emailed_at ? <><Mail size={12} /> {fmtDateTime(c.emailed_at)}</> : c.email ? "Email pending" : "No email"}</small>
        <small className="muted">{c.download_count} download(s)</small>
      </div>
    ) },
    { key: "state", label: "State", render: (c) => (c.revoked_at ? <Badge tone="danger">Revoked</Badge> : <Badge tone="success">Valid</Badge>) },
    { key: "actions", label: "", render: (c) => (
      <div className="row-actions" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="icon-btn" title="Preview PDF" onClick={() => downloadFile(`/admin/certificates/${c.registration_id}/pdf`, null, `${c.certificate_no}.pdf`, { open: true })}><Download size={15} /></button>
        {!c.revoked_at && c.email && <button type="button" className="icon-btn" title="Resend email / SMS" onClick={() => act(() => api.post(`/admin/certificates/${c.registration_id}/resend`), "Resent")}><Send size={15} /></button>}
        {can("admin") && !c.revoked_at && <button type="button" className="icon-btn icon-btn--danger" title="Revoke" onClick={() => revoke(c)}><Ban size={15} /></button>}
        {can("admin") && c.revoked_at && <button type="button" className="icon-btn" title="Reinstate" onClick={() => act(() => api.post(`/admin/certificates/${c.registration_id}/reinstate`), "Reinstated")}><RotateCcw size={15} /></button>}
      </div>
    ) },
  ];

  return (
    <>
      <PageHeader title="Certificates" crumbs={["Participation"]} subtitle="Digital अभिनंदन पत्र issued on verification."
        actions={can("admin") && <button type="button" className="btn btn--primary" onClick={sendPending}><Mail size={16} /> Email pending</button>} />
      <div className="toolbar">
        <label className="search"><Search size={16} aria-hidden="true" /><span className="sr-only">Search</span>
          <input className="input" placeholder="Name, mobile or certificate no" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <select className="input" aria-label="State" value={f.state} onChange={(e) => setF({ state: e.target.value })}>
          <option value="">Valid & revoked</option><option value="valid">Valid</option><option value="revoked">Revoked</option>
        </select>
        <select className="input" aria-label="Email" value={f.emailed} onChange={(e) => setF({ emailed: e.target.value })}>
          <option value="">Any email state</option><option value="yes">Emailed</option><option value="no">Not yet emailed</option>
        </select>
      </div>
      <section className="panel panel--flush">
        <DataTable columns={columns} rows={data?.data} loading={loading} error={error} empty="No certificates yet — they are issued when a registration is verified" />
        <Pagination meta={data?.meta} onPage={(p) => setF({ page: String(p) })} />
      </section>
    </>
  );
}
