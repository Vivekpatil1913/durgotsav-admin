import { AlertTriangle, CheckCircle2, Clock, Download, History, Mail, MailX, RefreshCw, RotateCcw, Search, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge, DataTable, Drawer, PageHeader, Pagination, Spinner, StatCard } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useUi } from "../context/UiContext.jsx";
import { useDebounced, useFetch } from "../hooks/useFetch.js";
import { clean, useQueryState } from "../hooks/useQueryState.js";
import { api, apiError, downloadFile } from "../lib/api.js";
import { fmtDateTime, fmtNumber, timeAgo } from "../lib/format.js";

// certificate_email_jobs.status
const EMAIL_STATUS = {
  queued: { label: "Queued", tone: "info" },
  processing: { label: "Sending", tone: "warning" },
  sent: { label: "Emailed", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  skipped: { label: "No email", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};
// certificate_email_log.outcome
const OUTCOME = { sent: "Sent", retry: "Failed — will retry", failed: "Failed", skipped: "Skipped", cancelled: "Cancelled", requeued: "Put back in queue" };

function Delivery({ c }) {
  const s = EMAIL_STATUS[c.email_status];
  return (
    <div className="cell-stack">
      {s ? <span><Badge tone={s.tone}>{s.label}</Badge></span> : <small>{c.emailed_at ? "Emailed" : c.email ? "Not queued" : "No email"}</small>}
      {c.emailed_at && <small><Mail size={12} /> {fmtDateTime(c.emailed_at)}</small>}
      {c.email_status === "queued" && c.email_attempts > 0 && <small className="muted">Retry at {fmtDateTime(c.email_next_attempt_at)}</small>}
      {c.email_status === "failed" && <small className="muted mono" title={c.email_error ?? ""}>{c.email_error_code}</small>}
      <small className="muted">{c.download_count} download(s)</small>
    </div>
  );
}

function QueueSummary({ stats, onFilter }) {
  if (!stats) return null;
  return (
    <>
      {!stats.mail_enabled && (
        <div className="alert alert--warning">
          <AlertTriangle size={16} /> Email is switched off on the server (SMTP is not configured). Certificate emails stay queued until it is set up.
        </div>
      )}
      <section className="stat-grid">
        <StatCard label="Waiting to send" icon={Clock} tone="warning" value={stats.queued}
          hint={stats.due_now ? `${fmtNumber(stats.due_now)} due now` : stats.next_run_at ? `Next retry ${fmtDateTime(stats.next_run_at)}` : "Queue is empty"}
          onClick={() => onFilter("queued")} />
        <StatCard label="Sending now" icon={Send} value={stats.processing}
          hint={stats.last_activity_at ? `Last activity ${timeAgo(stats.last_activity_at)}` : "No deliveries yet"}
          onClick={() => onFilter("processing")} />
        <StatCard label="Emailed" icon={CheckCircle2} tone="success" value={stats.sent}
          hint={`${fmtNumber(stats.sent_last_hour)} in the last hour`} onClick={() => onFilter("sent")} />
        <StatCard label="Failed" icon={MailX} tone="danger" value={stats.failed}
          hint="Rejected, or every retry failed" onClick={() => onFilter("failed")} />
        <StatCard label="No email address" icon={Mail} tone="gold" value={stats.skipped}
          hint="Download link by SMS only" onClick={() => onFilter("skipped")} />
      </section>
    </>
  );
}

function DeliveryLog({ cert, onClose }) {
  const { data, loading, error } = useFetch(cert ? `/admin/certificates/${cert.registration_id}/email-log` : null);
  const log = data?.data;
  const status = EMAIL_STATUS[log?.job?.status];
  return (
    <Drawer open={Boolean(cert)} onClose={onClose} title={cert ? `Email log · ${cert.certificate_no}` : ""}>
      {loading && <Spinner />}
      {error && <div className="alert alert--error">{error.message}</div>}
      {cert && log && (
        <div className="stack">
          <dl className="kv">
            <div><dt>Participant</dt><dd className="mr">{cert.name}</dd></div>
            <div><dt>दुर्गवीर No.</dt><dd className="mono">{cert.durgveer_no}</dd></div>
            <div><dt>Email</dt><dd>{cert.email ?? "—"}</dd></div>
            <div><dt>Status</dt><dd>{status ? <Badge tone={status.tone}>{status.label}</Badge> : "Not queued"}{log.job?.attempts ? ` · attempt ${log.job.attempts}` : ""}</dd></div>
            {log.job?.status === "queued" && log.job.attempts > 0 && <div><dt>Next attempt</dt><dd>{fmtDateTime(log.job.run_at)}</dd></div>}
            {log.job?.last_error && <div><dt>Last error</dt><dd><span className="mono">{log.job.last_error_code}</span> {log.job.last_error}</dd></div>}
            {log.job?.sent_count > 0 && <div><dt>Sent</dt><dd>{log.job.sent_count}× · last {fmtDateTime(log.job.sent_at)}</dd></div>}
          </dl>
          <h3 className="sub-title">Attempts</h3>
          {log.attempts.length === 0 ? <p className="muted">No delivery attempts yet.</p> : (
            <ul className="activity">
              {log.attempts.map((a) => (
                <li key={a.id}>
                  <span className="activity__dot" aria-hidden="true" />
                  <span>
                    <strong>{OUTCOME[a.outcome]}</strong> · attempt {a.attempt}{a.recipient ? ` · ${a.recipient}` : ""}
                    {a.error_code && <> · <span className="mono">{a.error_code}</span></>}
                    {a.error && <><br /><small className="muted">{a.error}</small></>}
                    {a.outcome === "sent" && (
                      <><br /><small className="muted">
                        दुर्गवीर {a.durgveer_no} · photo #{a.photo_id ?? "—"} · PDF {Math.round(a.pdf_bytes / 1024)} KB · render {a.render_ms} ms · SMTP {a.send_ms} ms
                      </small></>
                    )}
                  </span>
                  <time>{fmtDateTime(a.created_at)}</time>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Drawer>
  );
}

export default function Certificates() {
  const { can } = useAuth();
  const { toast, confirm } = useUi();
  const [f, setF] = useQueryState({ q: "", state: "", emailed: "", email_status: "", sort: "issued_at", dir: "desc", limit: "25", page: "1" });
  const [search, setSearch] = useState(f.q);
  const [logFor, setLogFor] = useState(null);
  const q = useDebounced(search);
  useEffect(() => {
    if (q !== f.q) setF({ q });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  const { data, loading, error, reload } = useFetch("/admin/certificates", clean({ ...f }));
  const queue = useFetch("/admin/certificates/email-queue");
  const stats = queue.data?.data;
  const reloadQueue = queue.reload;

  // Keep the queue counts live while a bulk send is running
  useEffect(() => {
    const t = setInterval(reloadQueue, 15_000);
    return () => clearInterval(t);
  }, [reloadQueue]);

  const act = async (fn, ok) => {
    try {
      await fn();
      toast(ok);
      reload();
      reloadQueue();
    } catch (err) {
      toast(apiError(err).message, "error");
    }
  };

  async function sendPending() {
    if (!(await confirm({ title: "Email all pending certificates?", message: "Every verified participant with an email who has not yet received their certificate will be queued. Each participant is emailed once.", confirmLabel: "Queue emails", tone: "primary" }))) return;
    act(async () => {
      const { data: res } = await api.post("/admin/certificates/send-pending");
      toast(`${fmtNumber(res.data.queued)} email(s) queued`, "info");
    }, "Sending in the background");
  }

  async function retryFailed() {
    if (!(await confirm({ title: "Retry failed emails?", message: "Failed certificate emails get a fresh set of attempts. Fix the cause first (SMTP login, quota, a missing photo or a wrong address).", confirmLabel: "Retry", tone: "primary" }))) return;
    act(async () => {
      const { data: res } = await api.post("/admin/certificates/retry-failed");
      toast(`${fmtNumber(res.data.queued)} email(s) queued again`, "info");
    }, "Retrying in the background");
  }

  const columns = [
    { key: "certificate_no", sortKey: "certificate_no", label: "Certificate", render: (c) => <span className="mono">{c.certificate_no}</span> },
    { key: "durgveer_no", sortKey: "durgveer_no", label: "दुर्गवीर No.", render: (c) => <span className="mono">{c.durgveer_no}</span> },
    { key: "name", sortKey: "name", label: "Participant", render: (c) => <div className="cell-stack"><strong className="mr">{c.name}</strong><small className="mono">{c.registration_no} · {c.phone}</small></div> },
    { key: "district", label: "District", render: (c) => <span className="mr">{c.district ?? "—"}</span> },
    { key: "issued_at", sortKey: "issued_at", sortFirst: "desc", label: "Issued", render: (c) => <small>{fmtDateTime(c.issued_at)}</small> },
    { key: "delivery", label: "Email", render: (c) => <Delivery c={c} /> },
    { key: "state", label: "State", render: (c) => (c.revoked_at ? <Badge tone="danger">Revoked</Badge> : <Badge tone="success">Valid</Badge>) },
    { key: "actions", label: "", render: (c) => (
      <div className="row-actions" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="icon-btn" title="Preview PDF" onClick={() => downloadFile(`/admin/certificates/${c.registration_id}/pdf`, null, `${c.certificate_no}.pdf`, { open: true })}><Download size={15} /></button>
        <button type="button" className="icon-btn" title="Email log" onClick={() => setLogFor(c)}><History size={15} /></button>
        {!c.revoked_at && c.email && c.email_status !== "processing" && (
          <button type="button" className="icon-btn" title={c.email_status === "failed" ? "Retry email" : "Resend email"}
            onClick={() => act(() => api.post(`/admin/certificates/${c.registration_id}/resend`), "Queued — it will be emailed shortly")}><Send size={15} /></button>
        )}
        {can("admin") && c.revoked_at && <button type="button" className="icon-btn" title="Reinstate" onClick={() => act(() => api.post(`/admin/certificates/${c.registration_id}/reinstate`), "Reinstated")}><RotateCcw size={15} /></button>}
      </div>
    ) },
  ];

  return (
    <>
      <PageHeader title="Certificates" crumbs={["Participation"]} subtitle="Digital अभिनंदन पत्र issued on verification and emailed automatically."
        actions={can("admin") && (
          <>
            {stats?.failed > 0 && <button type="button" className="btn btn--outline" onClick={retryFailed}><RefreshCw size={16} /> Retry failed ({fmtNumber(stats.failed)})</button>}
            <button type="button" className="btn btn--primary" onClick={sendPending}><Mail size={16} /> Email pending</button>
          </>
        )} />
      <QueueSummary stats={stats} onFilter={(s) => setF({ email_status: s })} />
      <div className="resource-tabs" role="tablist" aria-label="Certificate state">
        {[["", "All certificates"], ["valid", "Valid"], ["revoked", "Revoked"]].map(([k, l]) => (
          <button key={l} type="button" role="tab" aria-selected={f.state === k} className={`resource-tab ${f.state === k ? "is-active" : ""}`} onClick={() => setF({ state: k })}>{l}</button>
        ))}
      </div>
      <div className="toolbar">
        <label className="search"><Search size={16} aria-hidden="true" /><span className="sr-only">Search</span>
          <input className="input" placeholder="Name, mobile, certificate or दुर्गवीर no" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <select className="input" aria-label="Email delivery" value={f.email_status} onChange={(e) => setF({ email_status: e.target.value })}>
          <option value="">Any delivery status</option>
          {Object.entries(EMAIL_STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          <option value="none">Not queued</option>
        </select>
        <select className="input" aria-label="Email" value={f.emailed} onChange={(e) => setF({ emailed: e.target.value })}>
          <option value="">Any email state</option><option value="yes">Emailed</option><option value="no">Not yet emailed</option>
        </select>
      </div>
      <section className="panel panel--flush">
        <DataTable columns={columns} rows={data?.data} loading={loading} error={error} rowKey={(c) => c.id}
          sort={{ key: f.sort, dir: f.dir, onSort: setF }}
          startIndex={((data?.meta?.page ?? 1) - 1) * (data?.meta?.limit ?? 25)}
          empty="No certificates yet — they are issued when a registration is verified" />
        <Pagination meta={data?.meta} onPage={(p) => setF({ page: String(p) })} onLimit={(l) => setF({ limit: String(l) })} />
      </section>
      <DeliveryLog cert={logFor} onClose={() => setLogFor(null)} />
    </>
  );
}
