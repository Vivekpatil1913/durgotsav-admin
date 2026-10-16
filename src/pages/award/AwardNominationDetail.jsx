import { ArrowLeft, Download, ExternalLink, Eye, FileText, History, Link2, MessageSquarePlus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge, EmptyState, PageHeader, Spinner } from "../../components/ui.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useUi } from "../../context/UiContext.jsx";
import { useFetch } from "../../hooks/useFetch.js";
import { api, apiError, downloadFile } from "../../lib/api.js";
import { AWARD_BASE, AWARD_CATEGORY, AWARD_SECTION, AWARD_STATUS, optionLabel } from "../../lib/award.js";
import { fmtDate, fmtDateTime } from "../../lib/format.js";

const fmtSize = (b) => (!b ? "" : b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

function KV({ items }) {
  const shown = items.filter(([, v]) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && !v.length));
  if (!shown.length) return <p className="muted">—</p>;
  return <dl className="kv award-kv">{shown.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className="mr">{v}</dd></div>)}</dl>;
}

function Section({ title, children, count }) {
  return (
    <section className="panel award-section">
      <header className="panel__head"><h2>{title}{count !== undefined && <span className="tab-badge">{count}</span>}</h2></header>
      {children}
    </section>
  );
}

function RowsTable({ rows, cols, empty = "None provided" }) {
  if (!rows?.length) return <p className="muted">{empty}</p>;
  return (
    <div className="table-wrap">
      <table className="table award-mini-table">
        <thead><tr><th className="table__sno">#</th>{cols.map(([k, l]) => <th key={k}>{l}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={r.id ?? i}><td className="table__sno">{i + 1}</td>{cols.map(([k]) => <td key={k} className="mr award-pre">{r[k] ?? "—"}</td>)}</tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export default function AwardNominationDetail() {
  const { id } = useParams();
  const { hasPermission } = useAuth();
  const { toast, confirm } = useUi();
  const options = useFetch("/admin/shivdurg-award/options").data?.data?.options;
  const [n, setN] = useState(null);
  const [error, setError] = useState(null);
  const [next, setNext] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [remark, setRemark] = useState("");
  const [busy, setBusy] = useState(null);
  const canReview = hasPermission("shivdurg_award", "write");

  const load = useCallback(() => {
    setError(null);
    api.get(`/admin/shivdurg-award/nominations/${id}`).then((r) => setN(r.data.data)).catch((e) => setError(apiError(e)));
  }, [id]);
  useEffect(load, [load]);

  async function changeStatus() {
    if (!next) return;
    if (next === "not_selected" && !statusNote.trim()) return toast("Please give a reason for Not Selected", "error");
    const ok = await confirm({
      title: `Move to “${AWARD_STATUS[next].label}”?`,
      message: next === "selected"
        ? "This records the nomination as the winner of its category for this award year. Only one winner per category is allowed."
        : `Status changes from ${AWARD_STATUS[n.status].label} to ${AWARD_STATUS[next].label}. The change is recorded in the history and audit log.`,
      confirmLabel: "Change status",
      tone: next === "not_selected" ? "danger" : "primary",
    });
    if (!ok) return;
    setBusy("status");
    try {
      const { data } = await api.post(`/admin/shivdurg-award/nominations/${id}/status`, { status: next, remarks: statusNote.trim() || undefined });
      setN(data.data);
      setNext("");
      setStatusNote("");
      toast(`Status changed to ${AWARD_STATUS[data.data.status].label}`);
    } catch (err) {
      toast(apiError(err).message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function addRemark(e) {
    e.preventDefault();
    if (remark.trim().length < 2) return;
    setBusy("remark");
    try {
      const { data } = await api.post(`/admin/shivdurg-award/nominations/${id}/remarks`, { body: remark.trim() });
      setN((x) => ({ ...x, remarks: [{ ...data.data, admin_name: "You" }, ...x.remarks] }));
      setRemark("");
      toast("Remark added");
    } catch (err) {
      toast(apiError(err).message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function fetchDoc(doc, download) {
    setBusy(`doc-${doc.id}`);
    const url = `/admin/shivdurg-award/nominations/${id}/documents/${doc.id}`;
    // Open the preview tab during the click, so popup blockers allow it; fill it once the file arrives
    const tab = download ? null : window.open("", "_blank");
    try {
      if (download) {
        await downloadFile(url, { download: 1 }, doc.original_name || `document-${doc.id}`);
      } else {
        const res = await api.get(url, { responseType: "blob" });
        const href = URL.createObjectURL(res.data);
        if (tab) {
          tab.opener = null;
          tab.location.href = href;
        } else window.open(href, "_blank", "noopener");
        setTimeout(() => URL.revokeObjectURL(href), 120_000);
      }
    } catch (err) {
      tab?.close();
      toast(apiError(err).message || "Could not open the file", "error");
    } finally {
      setBusy(null);
    }
  }

  if (error) return <><Link to={`${AWARD_BASE}/nominations`} className="btn btn--ghost btn--sm"><ArrowLeft size={14} /> Back</Link><div className="alert alert--error" style={{ marginTop: 12 }}>{error.message}</div></>;
  if (!n) return <div className="page-loading"><Spinner size={22} /></div>;

  const isOrg = n.category === "organization";
  const d = n.details ?? {};
  const work = isOrg ? options?.organization_work : options?.individual_work;
  const status = AWARD_STATUS[n.status];

  return (
    <>
      <PageHeader
        title={<span className="mr">{n.nominee_name}</span>}
        crumbs={[AWARD_SECTION, "Nominations", n.reference_no]}
        subtitle={<span className="cluster cluster--tight"><span className="mono">{n.reference_no}</span><Badge tone={isOrg ? "gold" : "info"}>{AWARD_CATEGORY[n.category].label}</Badge><Badge tone={status.tone}>{status.label}</Badge><small className="muted">Submitted {fmtDateTime(n.submitted_at)}</small></span>}
        actions={<div className="cluster cluster--tight">
          <button type="button" className="btn btn--ghost btn--sm" onClick={load}><RefreshCw size={14} /> Refresh</button>
          <Link to={`${AWARD_BASE}/nominations`} className="btn btn--ghost btn--sm"><ArrowLeft size={14} /> All nominations</Link>
        </div>}
      />

      <div className="award-detail">
        <div className="award-detail__main">
          <Section title="Nominator · नामनिर्देशक">
            <KV items={[["Name", n.nominator_name], ["Mobile", <span className="mono">{n.nominator_mobile}</span>]]} />
          </Section>

          <Section title={isOrg ? "Organization · संस्थेची माहिती" : "Nominee · वैयक्तिक माहिती"}>
            <KV items={isOrg ? [
              ["Organization", n.nominee_name],
              ["Type", d.org_type === "other" ? `इतर — ${d.org_type_other}` : optionLabel(options?.org_types, d.org_type)],
              ["Established", [d.established_on && fmtDate(d.established_on), d.established_year].filter(Boolean).join(" · ")],
              ["Registration no.", d.registration_no], ["Registration date", d.registration_date && fmtDate(d.registration_date)],
              ["Registering authority", d.registration_authority], ["PAN", d.pan && <span className="mono">{d.pan}</span>],
              ["Website", d.website && <a href={d.website} target="_blank" rel="noopener noreferrer nofollow">{d.website} <ExternalLink size={12} /></a>],
              ["Email", n.email], ["Phone / mobile", <span className="mono">{n.mobile}</span>],
              ["Head office", n.address], ["District / taluka", `${n.district} / ${n.taluka}`], ["PIN code", d.pincode],
            ] : [
              ["Full name", n.nominee_name], ["Father / husband", d.father_or_husband_name],
              ["Date of birth", d.date_of_birth && `${fmtDate(d.date_of_birth)}${d.age !== undefined ? ` (age ${d.age} at submission)` : ""}`],
              ["Mobile", <span className="mono">{n.mobile}</span>], ["Email", n.email], ["Address", n.address],
              ["District / taluka", `${n.district} / ${n.taluka}`],
            ]} />
            {isOrg && (<>
              <h3 className="award-subtitle">Authorized officials</h3>
              <RowsTable rows={n.officials} cols={[["name", "Name"], ["designation", "Designation"], ["mobile", "Mobile"], ["email", "Email"], ["address", "Address"]]} />
            </>)}
          </Section>

          <Section title="Work · कार्याची माहिती">
            <KV items={[
              ["Work started", `${n.work_started_year} (${Math.max(0, new Date().getFullYear() - n.work_started_year)} years)`],
              ["Work categories", <div className="award-tags">{n.work_categories.map((k) => <span key={k} className="award-tag">{optionLabel(work, k)}</span>)}</div>],
              ["Other work", n.work_category_other],
              ...(isOrg ? [
                ["Conservation & protection", <span className="award-pre">{d.conservation_details}</span>],
                ["Research & documentation", d.research_documentation && <span className="award-pre">{d.research_documentation}</span>],
                ["Research resources", (d.research_tools ?? []).map((k) => optionLabel(options?.research_tools, k)).join(", ")],
                ["Youth & volunteers", [d.youth_participation, d.volunteer_count !== null && d.volunteer_count !== undefined && `Volunteers: ${d.volunteer_count}`].filter(Boolean).join(" · ")],
                ["Writing / media", d.media_publicity && <span className="award-pre">{d.media_publicity}</span>],
                ["Distinctive features", <span className="award-pre">{d.distinctive_features}</span>],
              ] : [
                ["Conservation work", <span className="award-pre">{d.conservation_work}</span>],
                ["Lectures / awareness", d.lectures_awareness && <span className="award-pre">{d.lectures_awareness}</span>],
                ["External references", d.external_references && <span className="award-pre">{d.external_references}</span>],
              ]),
            ]} />
          </Section>

          <Section title={isOrg ? "Major initiatives · प्रमुख उपक्रम" : "Notable works · उल्लेखनीय कार्ये"} count={n.activities.length}>
            <RowsTable rows={n.activities} cols={isOrg
              ? [["title", "Initiative"], ["period", "Date / period"], ["beneficiaries", "Beneficiaries"], ["details", "Details"]]
              : [["title", "Work"], ["fort_name", "Fort(s)"], ["work_type", "Type"], ["period", "Period"], ["details", "Details"]]} />
          </Section>
          <Section title="Research, writing & publications" count={n.publications.length}>
            <RowsTable rows={n.publications} cols={[["title", "Title"], ["pub_type", "Type"], ["publisher", "Publisher / medium"], ["year", "Year"], ["details", "Details"]]} />
          </Section>
          <Section title="Awards & honours received" count={n.honours.length}>
            <RowsTable rows={n.honours} cols={[["title", "Award"], ["awarded_by", "Awarded by"], ["year", "Year"], ["details", "Details"]]} />
          </Section>

          <Section title="Evidence · पुरावे व लिंक्स" count={n.documents.length}>
            {n.documents.length === 0 ? <EmptyState title="No evidence submitted" /> : (
              <ul className="award-docs">
                {n.documents.map((doc) => (
                  <li key={doc.id}>
                    <FileText size={18} aria-hidden="true" />
                    <div className="award-docs__body">
                      <strong className="mr">{doc.title || optionLabel(options?.document_types, doc.doc_type) || "Evidence"}</strong>
                      <small className="mr">{[optionLabel(options?.document_types, doc.doc_type), doc.description].filter(Boolean).join(" · ")}</small>
                      {doc.has_file && <small className="muted">{doc.original_name} · {doc.mime_type} · {fmtSize(doc.size_bytes)}</small>}
                      {doc.external_url && (
                        <a href={doc.external_url} target="_blank" rel="noopener noreferrer nofollow" className="award-docs__link"><Link2 size={13} /> {doc.external_url}</a>
                      )}
                    </div>
                    {doc.has_file && (
                      <div className="cluster cluster--tight">
                        <button type="button" className="btn btn--ghost btn--sm" disabled={busy === `doc-${doc.id}`} onClick={() => fetchDoc(doc, false)}>{busy === `doc-${doc.id}` ? <Spinner /> : <Eye size={14} />} Preview</button>
                        <button type="button" className="btn btn--ghost btn--sm" disabled={busy === `doc-${doc.id}`} onClick={() => fetchDoc(doc, true)}><Download size={14} /> Download</button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Declaration · घोषणापत्र">
            <KV items={[
              ["Accepted", fmtDateTime(n.declaration_accepted_at)], ["Place", n.declaration_place],
              ["Date", fmtDate(n.declaration_date)], ["Applicant / nominator", n.declaration_name],
              ["Submitted from", n.meta?.ip_address && <span className="mono">{n.meta.ip_address}</span>],
            ]} />
          </Section>
        </div>

        <aside className="award-detail__side">
          <section className="panel award-section">
            <header className="panel__head"><h2>Review status</h2><Badge tone={status.tone}>{status.label}</Badge></header>
            {canReview ? (n.allowed_transitions.length ? (
              <div className="award-status-form">
                <label className="label" htmlFor="aw-next">Move to</label>
                <select id="aw-next" className="input" value={next} onChange={(e) => setNext(e.target.value)}>
                  <option value="">Select new status…</option>
                  {n.allowed_transitions.map((s) => <option key={s} value={s}>{AWARD_STATUS[s].label} · {AWARD_STATUS[s].mr}</option>)}
                </select>
                <label className="label" htmlFor="aw-note">Review remarks {next === "not_selected" && <span className="req">*</span>}</label>
                <textarea id="aw-note" className="input mr" rows={3} maxLength={2000} value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder="Recorded with this status change" />
                <button type="button" className="btn btn--primary" disabled={!next || busy === "status"} onClick={changeStatus}>{busy === "status" && <Spinner />} Update status</button>
              </div>
            ) : <p className="muted">No further status changes available.</p>) : <p className="muted">You have read-only access.</p>}
          </section>

          <section className="panel award-section">
            <header className="panel__head"><h2>Committee remarks</h2><span className="tab-badge">{n.remarks.length}</span></header>
            {canReview && (
              <form onSubmit={addRemark} className="award-status-form">
                <label className="sr-only" htmlFor="aw-remark">New remark</label>
                <textarea id="aw-remark" className="input mr" rows={3} maxLength={4000} value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Notes for the committee (internal)" />
                <button type="submit" className="btn btn--ghost btn--sm" disabled={remark.trim().length < 2 || busy === "remark"}><MessageSquarePlus size={14} /> Add remark</button>
              </form>
            )}
            <ul className="award-feed">
              {n.remarks.map((r) => (
                <li key={r.id}><p className="mr award-pre">{r.body}</p><small className="muted">{r.admin_name ?? "Admin"} · {fmtDateTime(r.created_at)}</small></li>
              ))}
              {!n.remarks.length && <li className="muted">No remarks yet</li>}
            </ul>
          </section>

          <section className="panel award-section">
            <header className="panel__head"><h2><History size={16} /> Status history</h2></header>
            <ol className="award-history">
              {n.history.map((h) => (
                <li key={h.id}>
                  <span className="award-history__dot" aria-hidden="true" />
                  <div>
                    <strong>{h.from_status ? `${AWARD_STATUS[h.from_status]?.label} → ` : ""}{AWARD_STATUS[h.to_status]?.label}</strong>
                    {h.remarks && <p className="mr award-pre">{h.remarks}</p>}
                    <small className="muted">{h.admin_name ?? "Applicant (online)"} · {fmtDateTime(h.created_at)}</small>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </>
  );
}
