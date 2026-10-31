import { AlertTriangle, Award, CheckCircle2, ChevronLeft, ChevronRight, Copy, Download, ExternalLink, Link2, Mail, MessageSquareText, MessageSquareWarning, Pencil, RefreshCw, RotateCcw, Trash2, Undo2, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useUi } from "../context/UiContext.jsx";
import { api, apiError, assetUrl, downloadFile } from "../lib/api.js";
import { fmtDateTime, participantLine, STATUS } from "../lib/format.js";
import { Badge, Drawer, Field, Spinner } from "./ui.jsx";

// The certificate is generated only when an admin approves (after checking the photo and details); its email and SMS
// are queued at that moment. Reject, request info, duplicate and "back to pending" withdraw it.
const ACTIONS = {
  verify: { label: "Approve & generate certificate", icon: CheckCircle2, cls: "btn--success" },
  request_info: { label: "Request more info", icon: MessageSquareWarning, cls: "btn--ghost", needsNote: true },
  reject: { label: "Reject", icon: XCircle, cls: "btn--danger-ghost", needsNote: true },
  mark_duplicate: { label: "Mark as duplicate", icon: Copy, cls: "btn--warning-ghost" },
  reset: { label: "Move back to pending", icon: RotateCcw, cls: "btn--ghost" },
};

// SMS queue states (sms_messages.status)
const SMS_STATUS = {
  queued: "queued",
  processing: "sending",
  sent: "sent",
  logged: "logged (no SMS gateway configured)",
  failed: "failed",
  cancelled: "cancelled",
};

// Canned notes for the common cases in परिशिष्ट-अ §3.4 / §6 (shown to the participant)
const NOTES = [
  "छायाचित्रात आपण व प्रतिकृती दोन्ही स्पष्ट दिसत नाहीत. कृपया नवीन छायाचित्र पाठवा.",
  "हे छायाचित्र दुसऱ्या नोंदणीत आधीच वापरले आहे.",
  "छायाचित्र दुर्गाच्या प्रतिकृतीशी संबंधित नाही.",
  "इंटरनेटवरील / डिजिटल फेरफार केलेले छायाचित्र स्वीकारले जाणार नाही.",
];

/**
 * onReviewed(registration): called after a review decision instead of onChanged — a review queue uses it to move on
 * to the next record.
 * nav: { prev, next, position } — previous / next record buttons (and ← / → keys); prev / next null at the ends.
 */
export function RegistrationDrawer({ id, lookups, onClose, onChanged, onReviewed, nav }) {
  const { hasPermission } = useAuth();
  const { toast } = useUi();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState(null); // 'reject' | 'request_info' | 'edit'
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState({});
  const top = useRef(null);

  useEffect(() => {
    if (!id) return undefined;
    let current = true; // moving to another record quickly must never show this response for that record
    setData(null);
    setError(null);
    setMode(null);
    setNote("");
    setEdit({});
    top.current?.parentElement?.scrollTo({ top: 0 });
    api.get(`/admin/registrations/${id}`)
      .then((r) => current && setData(r.data.data))
      .catch((e) => current && setError(apiError(e)));
    return () => {
      current = false;
    };
  }, [id]);

  // ← / → move through the queue (not while typing a note or while a decision is being saved)
  useEffect(() => {
    if (!id || !nav) return undefined;
    const onKey = (e) => {
      if (busy || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.target.closest?.("input, textarea, select, [contenteditable='true']")) return;
      const go = e.key === "ArrowLeft" ? nav.prev : e.key === "ArrowRight" ? nav.next : null;
      if (!go) return;
      e.preventDefault();
      go();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [id, nav, busy]);

  async function run(action) {
    if (ACTIONS[action].needsNote && mode !== action) {
      setMode(action);
      return;
    }
    if (ACTIONS[action].needsNote && !note.trim()) return toast("Please write a note for the participant", "error");
    // Always the record on screen (data), not the requested one (id), which may already point at the next record
    const rid = data.id;
    setBusy(true);
    try {
      const { data: res } = await api.post(`/admin/registrations/${rid}/review`, { action, note: note.trim() || undefined });
      setData((d) => (d?.id === rid ? res.data : d));
      setMode(null);
      setNote("");
      toast(action === "verify" ? "Approved — certificate generated, email and SMS queued" : action === "mark_duplicate" ? "Marked as duplicate" : `Registration ${STATUS[res.data.status].label.toLowerCase()}`);
      if (onReviewed) onReviewed(res.data);
      else onChanged?.();
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
      ["district_id", "fort_id", "members_count"].forEach((k) => k in payload && (payload[k] = payload[k] ? Number(payload[k]) : null));
      const { data: res } = await api.put(`/admin/registrations/${data.id}`, payload);
      setData(res.data);
      setMode(null);
      toast(payload.name ? "Details updated — the certificate now prints the corrected name" : "Details updated");
      onChanged?.();
    } catch (err) {
      toast(apiError(err).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    const { data: res } = await api.post(`/admin/registrations/${data.id}/restore`);
    setData(res.data);
    toast("Restored");
    onChanged?.();
  }

  // Issues the certificate if the registration has none, makes a withdrawn one valid, renders it with the current name
  async function regenerate() {
    const rid = data.id;
    const had = Boolean(data.certificate);
    setBusy(true);
    try {
      const { data: res } = await api.post(`/admin/registrations/${rid}/certificate/regenerate`);
      setData((d) => (d?.id === rid ? res.data : d));
      toast(had ? "Certificate regenerated" : "Certificate issued");
      onChanged?.();
    } catch (err) {
      toast(apiError(err).message, "error");
    } finally {
      setBusy(false);
    }
  }

  // The certificate link to the registered mobile again: queued, the background worker sends it within seconds
  async function sendSms() {
    const rid = data.id;
    setBusy(true);
    try {
      await api.post(`/admin/registrations/${rid}/sms`);
      toast("SMS queued — it goes out in a few seconds");
      const fresh = await api.get(`/admin/registrations/${rid}`);
      setData((d) => (d?.id === rid ? fresh.data.data : d));
    } catch (err) {
      toast(apiError(err).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink(link) {
    try {
      await navigator.clipboard.writeText(link);
      toast("Participant's link copied");
    } catch {
      toast(link);
    }
  }

  const r = data;
  // position 1 = main photo, 2 = optional second view; non-current rows are superseded uploads
  const current = r?.photos.find((p) => p.is_current && (p.position ?? 1) === 1);
  const second = r?.photos.find((p) => p.is_current && p.position === 2);
  const earlier = r?.photos.filter((p) => !p.is_current) ?? [];
  const cert = r?.certificate;
  // only an approved registration has (or can be given) a certificate
  const certifiable = r && !r.deleted_at && r.status === "verified";
  const certValid = certifiable && cert && !cert.revoked_at;
  const canCertificates = hasPermission("certificates", "write");
  const canWrite = hasPermission("registrations", "write");

  return (
    <Drawer open={Boolean(id)} onClose={onClose} wide title={r ? <>{r.registration_no} <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge></> : "Registration"}
      actions={nav && (
        <div className="drawer-nav" role="group" aria-label="Review queue">
          <button type="button" className="icon-btn" onClick={nav.prev} disabled={!nav.prev || busy} title="Previous record (←)" aria-label="Previous record"><ChevronLeft size={18} /></button>
          <span className="drawer-nav__pos" aria-live="polite">{nav.position}</span>
          <button type="button" className="icon-btn" onClick={nav.next} disabled={!nav.next || busy} title="Next record (→)" aria-label="Next record"><ChevronRight size={18} /></button>
        </div>
      )}
      footer={r && !r.deleted_at && r.status !== "verified" && mode !== "edit" && (
        <div className="review-bar">
          {mode && ACTIONS[mode]?.needsNote && (
            <div className="review-bar__note">
              <label htmlFor="review-note">
                {mode === "reject" ? "Reason for rejection (no certificate is generated; shown on their status page and emailed to the participant)" : "Note to participant (shown on their status page; they reply with a new photo or note, then it comes back for review)"}
                <span className="req">*</span>
              </label>
              <textarea id="review-note" className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} required aria-required="true" aria-describedby="review-note-hint" autoFocus />
              <small id="review-note-hint" className="field__hint">
                {mode === "reject"
                  ? r.email ? `Required. Emailed to ${r.email}, with a link to register again with a proper photo while registration is open.` : "Required. This participant has no email address — they will see the reason on their status page only."
                  : "Required."}
              </small>
              <div className="chips">{NOTES.map((n) => <button key={n} type="button" className="chip" onClick={() => setNote(n)}>{n.slice(0, 38)}…</button>)}</div>
            </div>
          )}
          <div className="review-bar__actions">
            {onReviewed && !mode && <span className="review-bar__hint">The next record opens after your decision</span>}
            {(r.status === "rejected" || r.status === "duplicate" ? ["verify", "reset"] : ["verify", "mark_duplicate", "reject"]).map((a) => {
              const { label, icon: Icon, cls } = ACTIONS[a];
              return (
                <button key={a} type="button" className={`btn ${mode === a ? (a === "reject" ? "btn--danger" : "btn--primary") : cls}`} disabled={busy || (mode === a && ACTIONS[a].needsNote && !note.trim())} onClick={() => run(a)}>
                  {busy && mode === a ? <Spinner /> : <Icon size={16} />} {mode === a ? `Confirm: ${label}` : label}
                </button>
              );
            })}
            {mode && <button type="button" className="btn btn--ghost" onClick={() => setMode(null)}>Cancel</button>}
          </div>
        </div>
      )}
    >
      <div ref={top} aria-hidden="true" />
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
          {r.same_phone_total > 0 && (
            <div className="alert alert--info">
              This mobile number has {r.same_phone_total}{r.same_phone_capped ? "+" : ""} other registration(s){r.same_phone_total > r.same_phone_registrations.length ? `; the newest ${r.same_phone_registrations.length}` : ""}: {r.same_phone_registrations.map((s) => `${s.registration_no} (${STATUS[s.status].label})`).join(", ")}.
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
                  {/* What the single-page form collects; organisation, members, city and fort only on earlier registrations that have them */}
                  {[["name", "Name (printed on certificate)"], ["phone", "Mobile"], ["whatsapp_number", "WhatsApp"], ["email", "Email"],
                    ...(r.participant_type || r.organization_name ? [["organization_name", "Organisation"]] : []),
                    ...(r.members_count ? [["members_count", "Members"]] : []),
                    ...(r.city ? [["city", "City"]] : []),
                  ].map(([k, label]) => (
                    <Field key={k} label={label}>{(p) => <input {...p} className="input" defaultValue={r[k] ?? ""} onChange={(e) => setEdit((s) => ({ ...s, [k]: e.target.value }))} />}</Field>
                  ))}
                  <Field label="District">{(p) => (
                    <select {...p} className="input" defaultValue={r.district_id ?? ""} onChange={(e) => setEdit((s) => ({ ...s, district_id: e.target.value }))}>
                      <option value="">—</option>{lookups.districts.map((d) => <option key={d.id} value={d.id}>{d.name_mr}</option>)}
                    </select>)}</Field>
                  {r.fort_id && <Field label="Fort">{(p) => (
                    <select {...p} className="input" defaultValue={r.fort_id ?? ""} onChange={(e) => setEdit((s) => ({ ...s, fort_id: e.target.value }))}>
                      <option value="">Other fort</option>{lookups.forts.map((f) => <option key={f.id} value={f.id}>{f.name_mr}</option>)}
                    </select>)}</Field>}
                  <div className="cluster">
                    <button type="button" className="btn btn--primary" onClick={saveEdit} disabled={busy}>{busy && <Spinner />} Save</button>
                    <button type="button" className="btn btn--ghost" onClick={() => setMode(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <dl className="kv">
                    <div><dt>Name</dt><dd className="mr">{r.name}</dd></div>
                    {participantLine(r) && <div><dt>Type</dt><dd>{participantLine(r)}</dd></div>}
                    <div><dt>Mobile</dt><dd><a href={`tel:${r.phone}`}>{r.phone}</a></dd></div>
                    <div><dt>WhatsApp</dt><dd>{r.whatsapp_number ? <a href={`https://wa.me/91${r.whatsapp_number}`} target="_blank" rel="noreferrer">{r.whatsapp_number}</a> : "—"}</dd></div>
                    <div><dt>Email</dt><dd>{r.email ? <a href={`mailto:${r.email}`}>{r.email}</a> : "—"}</dd></div>
                    <div><dt>Location</dt><dd className="mr">{[r.city, r.district, r.country !== "India" ? r.country : null].filter(Boolean).join(", ") || "—"}</dd></div>
                    {r.taluka && <div><dt>Taluka</dt><dd className="mr">{r.taluka}</dd></div>}
                    {r.fort && <div><dt>Fort</dt><dd className="mr">{r.fort}</dd></div>}
                    {r.replica_notes && <div><dt>Notes</dt><dd className="mr">{r.replica_notes}</dd></div>}
                    <div><dt>Submitted</dt><dd>{fmtDateTime(r.created_at)} · {r.source}</dd></div>
                    {r.reviewed_at && <div><dt>Reviewed</dt><dd>{fmtDateTime(r.reviewed_at)}{r.reviewed_by_name ? ` by ${r.reviewed_by_name}` : ""}</dd></div>}
                    {r.review_note && <div><dt>Review note</dt><dd className="mr">{r.review_note}</dd></div>}
                  </dl>
                  <div className="cluster">
                    {/* SRS v2.1 §6: correct typing mistakes in the name (and other details) */}
                    {canWrite && !r.deleted_at && (
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setEdit({}); setMode("edit"); }}>
                        <Pencil size={14} /> Edit details
                      </button>
                    )}
                    {/* what the participant sees (status now, certificate once approved) — the page the SMS links to */}
                    {r.participant_link && (
                      <>
                        <a className="btn btn--ghost btn--sm" href={r.participant_link} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Participant page</a>
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => copyLink(r.participant_link)}><Link2 size={14} /> Copy link</button>
                      </>
                    )}
                  </div>
                </>
              )}

              {cert && (
                <section className="cert-box">
                  <h3><Award size={16} /> {cert.certificate_no} · दुर्गवीर क्र. {cert.durgveer_no}</h3>
                  <p className="muted">
                    {cert.revoked_at ? <Badge tone="danger">Revoked</Badge> : <Badge tone="success">Valid</Badge>} Issued {fmtDateTime(cert.issued_at)}
                    {cert.emailed_at && <> · <Mail size={12} /> emailed {fmtDateTime(cert.emailed_at)}</>} · downloaded {cert.download_count}×
                    {!cert.emailed_at && (!r.email ? <> · no email address (SMS link only)</> : cert.email_status && <> · email {cert.email_status === "skipped" ? "not sent (no address)" : cert.email_status}</>)}
                  </p>
                  {cert.email_status === "failed" && cert.email_error && <p className="muted">Email error: {cert.email_error}</p>}
                  {cert.revoke_reason && <p className="muted">Reason: {cert.revoke_reason}</p>}
                  {cert.regenerated_at && <p className="muted">Regenerated {fmtDateTime(cert.regenerated_at)}</p>}
                  <div className="cluster">
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => downloadFile(`/admin/certificates/${r.id}/pdf`, null, `${cert.certificate_no}.pdf`, { open: true })}>
                      <Download size={14} /> Preview PDF
                    </button>
                    {canCertificates && certifiable && (
                      <button type="button" className="btn btn--ghost btn--sm" onClick={regenerate} disabled={busy} title="Render the certificate again with the current name and photo (after correcting a typo); makes a withdrawn certificate valid again">
                        {busy ? <Spinner /> : <RefreshCw size={14} />} Regenerate
                      </button>
                    )}
                    {canWrite && certValid && (
                      <button type="button" className="btn btn--ghost btn--sm" onClick={sendSms} disabled={busy} title={`Send the certificate link to ${r.phone} by SMS`}>
                        <MessageSquareText size={14} /> Send SMS
                      </button>
                    )}
                  </div>
                </section>
              )}
              {!cert && certifiable && canCertificates && (
                <section className="cert-box">
                  <h3><Award size={16} /> No certificate yet</h3>
                  <p className="muted">Approved before certificates were recorded here.</p>
                  <div className="cluster">
                    <button type="button" className="btn btn--primary btn--sm" onClick={regenerate} disabled={busy}>
                      {busy ? <Spinner /> : <Award size={14} />} Generate certificate
                    </button>
                  </div>
                </section>
              )}
              {!cert && r.status === "pending" && !r.deleted_at && (
                <p className="muted">No certificate yet — it is generated when you approve this registration.</p>
              )}

              {r.sms?.length > 0 && (
                <section>
                  <h3 className="sub-title">SMS</h3>
                  <ul className="activity">
                    {r.sms.map((s) => (
                      <li key={s.id}>
                        <span className="activity__dot" aria-hidden="true" />
                        <span>
                          <strong>{s.purpose === "registration_ack" ? "Registration received" : "Certificate link"}</strong>
                          {" · "}{SMS_STATUS[s.status] ?? s.status}{s.error && s.status !== "sent" ? ` — ${s.error}` : ""}
                          {" · "}{s.requested_by_name ?? "automatic"} · {s.phone}
                        </span>
                        <time>{fmtDateTime(s.sent_at ?? s.created_at)}</time>
                      </li>
                    ))}
                  </ul>
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
