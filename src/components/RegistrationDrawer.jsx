import { AlertTriangle, Award, CheckCircle2, Copy, Download, Mail, MessageSquareWarning, RotateCcw, Star, Trash2, Undo2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useUi } from "../context/UiContext.jsx";
import { api, apiError, assetUrl, downloadFile } from "../lib/api.js";
import { fmtDateTime, PARTICIPANT_TYPES, STATUS } from "../lib/format.js";
import { Badge, Drawer, Field, Spinner } from "./ui.jsx";

const ACTIONS = {
  verify: { label: "Verify & issue certificate", icon: CheckCircle2, cls: "btn--success" },
  request_info: { label: "Request more info", icon: MessageSquareWarning, cls: "btn--ghost", needsNote: true },
  reject: { label: "Reject", icon: XCircle, cls: "btn--danger-ghost", needsNote: true },
  mark_duplicate: { label: "Mark as duplicate", icon: Copy, cls: "btn--warning-ghost" },
  reset: { label: "Move back to pending", icon: RotateCcw, cls: "btn--ghost" },
};

// Canned notes for the common cases in परिशिष्ट-अ §3.4 / §6 (shown to the participant)
const NOTES = [
  "छायाचित्रात आपण व प्रतिकृती दोन्ही स्पष्ट दिसत नाहीत. कृपया नवीन छायाचित्र पाठवा.",
  "हे छायाचित्र दुसऱ्या नोंदणीत आधीच वापरले आहे.",
  "छायाचित्र दुर्गाच्या प्रतिकृतीशी संबंधित नाही.",
  "इंटरनेटवरील / डिजिटल फेरफार केलेले छायाचित्र स्वीकारले जाणार नाही.",
];

export function RegistrationDrawer({ id, lookups, onClose, onChanged }) {
  const { hasPermission } = useAuth();
  const { toast } = useUi();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState(null); // 'reject' | 'request_info' | 'edit'
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState({});

  useEffect(() => {
    if (!id) return;
    setData(null);
    setMode(null);
    setNote("");
    api.get(`/admin/registrations/${id}`).then((r) => setData(r.data.data)).catch((e) => setError(apiError(e)));
  }, [id]);

  async function run(action) {
    if (ACTIONS[action].needsNote && mode !== action) {
      setMode(action);
      return;
    }
    if (ACTIONS[action].needsNote && !note.trim()) return toast("Please write a note for the participant", "error");
    setBusy(true);
    try {
      const { data: res } = await api.post(`/admin/registrations/${id}/review`, { action, note: note.trim() || undefined });
      setData(res.data);
      setMode(null);
      setNote("");
      toast(action === "verify" ? "Verified — certificate issued" : action === "mark_duplicate" ? "Marked as duplicate" : `Registration ${STATUS[res.data.status].label.toLowerCase()}`);
      onChanged?.();
    } catch (err) {
      toast(apiError(err).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function feature(photo) {
    try {
      const { data: res } = await api.post("/admin/registrations/photos/feature", { photo_ids: [photo.id], featured: !photo.is_featured });
      if (res.data.skipped) return toast("Only photos of verified registrations can be featured", "error");
      setData((d) => ({ ...d, photos: d.photos.map((p) => (p.id === photo.id ? { ...p, is_featured: !p.is_featured } : p)) }));
      toast(photo.is_featured ? "Removed from gallery" : "Added to public gallery");
      onChanged?.();
    } catch (err) {
      toast(apiError(err).message, "error");
    }
  }

  async function saveEdit() {
    setBusy(true);
    try {
      const payload = { ...edit };
      ["district_id", "fort_id"].forEach((k) => k in payload && (payload[k] = payload[k] ? Number(payload[k]) : null));
      const { data: res } = await api.put(`/admin/registrations/${id}`, payload);
      setData(res.data);
      setMode(null);
      toast("Details updated");
      onChanged?.();
    } catch (err) {
      toast(apiError(err).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    const { data: res } = await api.post(`/admin/registrations/${id}/restore`);
    setData(res.data);
    toast("Restored");
    onChanged?.();
  }

  const r = data;
  // position 1 = main photo, 2 = optional second view; non-current rows are superseded uploads
  const current = r?.photos.find((p) => p.is_current && (p.position ?? 1) === 1);
  const second = r?.photos.find((p) => p.is_current && p.position === 2);
  const earlier = r?.photos.filter((p) => !p.is_current) ?? [];
  const cert = r?.certificate;

  return (
    <Drawer open={Boolean(id)} onClose={onClose} wide title={r ? <>{r.registration_no} <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge></> : "Registration"}
      footer={r && !r.deleted_at && r.status !== "verified" && mode !== "edit" && (
        <div className="review-bar">
          {mode && ACTIONS[mode]?.needsNote && (
            <div className="review-bar__note">
              <label htmlFor="review-note">Note to participant (shown on their status page)</label>
              <textarea id="review-note" className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} autoFocus />
              <div className="chips">{NOTES.map((n) => <button key={n} type="button" className="chip" onClick={() => setNote(n)}>{n.slice(0, 38)}…</button>)}</div>
            </div>
          )}
          <div className="review-bar__actions">
            {(r.status === "rejected" || r.status === "duplicate" ? ["verify", "reset"] : ["verify", "mark_duplicate", "reject"]).map((a) => {
              const { label, icon: Icon, cls } = ACTIONS[a];
              return (
                <button key={a} type="button" className={`btn ${mode === a ? (a === "reject" ? "btn--danger" : "btn--primary") : cls}`} disabled={busy} onClick={() => run(a)}>
                  {busy && mode === a ? <Spinner /> : <Icon size={16} />} {mode === a ? `Confirm: ${label}` : label}
                </button>
              );
            })}
            {mode && <button type="button" className="btn btn--ghost" onClick={() => setMode(null)}>Cancel</button>}
          </div>
        </div>
      )}
    >
      {error && <div className="alert alert--error">{error.message}</div>}
      {!r && !error && <div className="page-loading"><Spinner size={22} /></div>}
      {r && (
        <div className="reg-detail">
          {r.deleted_at && (
            <div className="alert alert--warning"><Trash2 size={16} /> In trash since {fmtDateTime(r.deleted_at)}.
              {hasPermission("registrations", "delete") && <button type="button" className="btn btn--sm btn--ghost" onClick={restore}><Undo2 size={14} /> Restore</button>}
            </div>
          )}
          {current?.duplicate_of_photo_id && (
            <div className="alert alert--warning dup-alert">
              <AlertTriangle size={16} />
              <span>This photo matches a photo in registration <strong>{current.duplicate_of_registration_no}</strong>{current.duplicate_of_registration_name && <> ({current.duplicate_of_registration_name})</>} (PDF §3.4: the same photo may not be reused).</span>
              {current.duplicate_thumb_path && <img src={assetUrl(current.duplicate_thumb_path)} alt="Matching earlier photo" />}
            </div>
          )}
          {second?.duplicate_of_photo_id && (
            <div className="alert alert--warning dup-alert">
              <AlertTriangle size={16} />
              <span>The second photo matches a photo in registration <strong>{second.duplicate_of_registration_no}</strong>{second.duplicate_of_registration_name && <> ({second.duplicate_of_registration_name})</>}.</span>
              {second.duplicate_thumb_path && <img src={assetUrl(second.duplicate_thumb_path)} alt="Matching earlier photo" />}
            </div>
          )}
          {r.same_phone_registrations.length > 0 && (
            <div className="alert alert--info">
              This mobile number has {r.same_phone_registrations.length} other registration(s): {r.same_phone_registrations.map((s) => `${s.registration_no} (${STATUS[s.status].label})`).join(", ")}.
            </div>
          )}

          <div className="reg-detail__grid">
            <div className="reg-detail__photos">
              {current && (
                <figure className="photo-main">
                  <a href={assetUrl(current.image_path)} target="_blank" rel="noopener noreferrer"><img src={assetUrl(current.image_path)} alt={`Photo submitted by ${r.name}`} /></a>
                  <figcaption>
                    <span>{current.width}×{current.height} · {Math.round((current.size_bytes || 0) / 1024)} KB{current.ai_score != null ? ` · 2025 AI score ${current.ai_score}` : ""}</span>
                  </figcaption>
                </figure>
              )}
              {second && (
                <figure className="photo-main photo-main--second">
                  <a href={assetUrl(second.image_path)} target="_blank" rel="noopener noreferrer"><img src={assetUrl(second.image_path)} alt={`Second photo submitted by ${r.name}`} /></a>
                  <figcaption>
                    <span>Second photo · {second.width}×{second.height} · {Math.round((second.size_bytes || 0) / 1024)} KB</span>
                  </figcaption>
                </figure>
              )}
              {earlier.length > 0 && (
                <div className="photo-history">
                  <span className="muted">Earlier submissions</span>
                  {earlier.map((p) => <a key={p.id} href={assetUrl(p.image_path)} target="_blank" rel="noopener noreferrer"><img src={assetUrl(p.thumb_path)} alt="Earlier photo" /></a>)}
                </div>
              )}
            </div>

            <div className="stack">
              {mode === "edit" ? (
                <div className="stack">
                  {[["name", "Name (printed on certificate)"], ["organization_name", "Organisation"], ["phone", "Mobile"], ["email", "Email"], ["city", "City"]].map(([k, label]) => (
                    <Field key={k} label={label}>{(p) => <input {...p} className="input" defaultValue={r[k] ?? ""} onChange={(e) => setEdit((s) => ({ ...s, [k]: e.target.value }))} />}</Field>
                  ))}
                  <Field label="District">{(p) => (
                    <select {...p} className="input" defaultValue={r.district_id ?? ""} onChange={(e) => setEdit((s) => ({ ...s, district_id: e.target.value }))}>
                      <option value="">—</option>{lookups.districts.map((d) => <option key={d.id} value={d.id}>{d.name_mr}</option>)}
                    </select>)}</Field>
                  <Field label="Fort">{(p) => (
                    <select {...p} className="input" defaultValue={r.fort_id ?? ""} onChange={(e) => setEdit((s) => ({ ...s, fort_id: e.target.value }))}>
                      <option value="">Other fort</option>{lookups.forts.map((f) => <option key={f.id} value={f.id}>{f.name_mr}</option>)}
                    </select>)}</Field>
                  <div className="cluster">
                    <button type="button" className="btn btn--primary" onClick={saveEdit} disabled={busy}>{busy && <Spinner />} Save</button>
                    <button type="button" className="btn btn--ghost" onClick={() => setMode(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <dl className="kv">
                    <div><dt>Name</dt><dd className="mr">{r.name}</dd></div>
                    <div><dt>Type</dt><dd>{PARTICIPANT_TYPES[r.participant_type]}{r.organization_name ? ` · ${r.organization_name}` : ""}</dd></div>
                    <div><dt>Mobile</dt><dd><a href={`tel:${r.phone}`}>{r.phone}</a></dd></div>
                    <div><dt>Email</dt><dd>{r.email ? <a href={`mailto:${r.email}`}>{r.email}</a> : "—"}</dd></div>
                    <div><dt>Location</dt><dd className="mr">{[r.city, r.district, r.country !== "India" ? r.country : null].filter(Boolean).join(", ") || "—"}</dd></div>
                    <div><dt>Fort</dt><dd className="mr">{r.fort ?? "Other"}</dd></div>
                    {r.replica_notes && <div><dt>Notes</dt><dd className="mr">{r.replica_notes}</dd></div>}
                    <div><dt>Submitted</dt><dd>{fmtDateTime(r.created_at)} · {r.source}</dd></div>
                    {r.reviewed_at && <div><dt>Reviewed</dt><dd>{fmtDateTime(r.reviewed_at)}{r.reviewed_by_name ? ` by ${r.reviewed_by_name}` : ""}</dd></div>}
                    {r.review_note && <div><dt>Review note</dt><dd className="mr">{r.review_note}</dd></div>}
                  </dl>
                </>
              )}

              {cert && (
                <section className="cert-box">
                  <h3><Award size={16} /> {cert.certificate_no}</h3>
                  <p className="muted">
                    {cert.revoked_at ? <Badge tone="danger">Revoked</Badge> : <Badge tone="success">Valid</Badge>} Issued {fmtDateTime(cert.issued_at)}
                    {cert.emailed_at && <> · <Mail size={12} /> emailed {fmtDateTime(cert.emailed_at)}</>} · downloaded {cert.download_count}×
                  </p>
                  {cert.revoke_reason && <p className="muted">Reason: {cert.revoke_reason}</p>}
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => downloadFile(`/admin/certificates/${r.id}/pdf`, null, `${cert.certificate_no}.pdf`, { open: true })}>
                    <Download size={14} /> Preview PDF
                  </button>
                </section>
              )}

              {r.history.length > 0 && (
                <section>
                  <h3 className="sub-title">History</h3>
                  <ul className="activity">
                    {r.history.map((h, i) => (
                      <li key={i}>
                        <span className="activity__dot" aria-hidden="true" />
                        <span><strong>{h.admin_name ?? "System"}</strong> {h.action.replace(/_/g, " ")}{h.meta?.note ? ` — “${h.meta.note}”` : ""}</span>
                        <time>{fmtDateTime(h.created_at)}</time>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}
