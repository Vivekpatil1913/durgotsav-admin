import { Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Field, PageHeader, Spinner } from "../../components/ui.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useUi } from "../../context/UiContext.jsx";
import { api, apiError } from "../../lib/api.js";
import { AWARD_SECTION } from "../../lib/award.js";
import { fmtDateTime } from "../../lib/format.js";

// Nomination dates are entered and shown in IST regardless of the admin's computer time zone
const toIstInput = (iso) => {
  if (!iso) return "";
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
};
const fromIstInput = (v) => (v ? `${v}:00+05:30` : "");

const LISTS = [
  ["objectives", "Objectives (उद्दिष्टे)"],
  ["eligibility", "Eligibility (पात्रता)"],
  ["instructions", "Nomination instructions (सूचना)"],
  ["documents", "Supporting documents (कागदपत्रे)"],
  ["process", "Process steps (प्रक्रिया)"],
];
const WINDOW = { open: ["Open now", "success"], not_started: ["Not started", "info"], closed: ["Closed", "danger"], disabled: ["Disabled", "danger"] };
const FIELDS = ["year", "reference_prefix", "title", "title_en", "tagline", "tagline_en", "nominations_enabled", "nomination_opens_at",
  "nomination_closes_at", "scrutiny_starts_on", "scrutiny_ends_on", "closed_note", "closed_note_en", "prize_individual", "prize_individual_en",
  "prize_organization", "prize_organization_en", "max_upload_mb", "max_documents", "allow_video", "content", "content_en"];

const cleanContent = (c = {}) => ({
  intro: c.intro ?? "", help: c.help ?? "",
  ...Object.fromEntries(LISTS.map(([k]) => [k, (c[k] ?? []).map((x) => x.trim()).filter(Boolean)])),
  faqs: (c.faqs ?? []).filter((f) => f.q.trim() && f.a.trim()),
});

export default function AwardSettings() {
  const { toast } = useUi();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("shivdurg_award_config", "write");
  const [v, setV] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [contentLang, setContentLang] = useState("content"); // "content" (मराठी) | "content_en"

  useEffect(() => {
    api.get("/admin/shivdurg-award/config").then((r) => setV(r.data.data)).catch((e) => toast(apiError(e).message, "error"));
  }, [toast]);

  if (!v) return <div className="page-loading"><Spinner size={22} /></div>;
  const set = (k, val) => setV((s) => ({ ...s, [k]: val }));
  const ckey = contentLang;
  const setContent = (k, val) => setV((s) => ({ ...s, [ckey]: { ...s[ckey], [k]: val } }));
  const c = v[ckey] ?? {};
  const err = (k) => errors[k];

  async function save() {
    setSaving(true);
    setErrors({});
    try {
      const body = Object.fromEntries(FIELDS.map((k) => [k, v[k]]));
      body.content = cleanContent(v.content);
      body.content_en = cleanContent(v.content_en);
      const { data } = await api.put("/admin/shivdurg-award/config", body);
      setV(data.data);
      toast("Award settings saved — the website updates within a minute");
    } catch (e) {
      const ae = apiError(e);
      setErrors(ae.details || {});
      toast(ae.message, "error");
    } finally {
      setSaving(false);
    }
  }

  const [wl, wt] = WINDOW[v.status?.reason] ?? ["", "neutral"];
  const text = (k, label, { area, hint, mr = true, type = "text" } = {}) => (
    <div className={area ? "form-grid__full" : "form-grid__half"}>
      <Field label={label} error={err(k)} hint={hint}>
        {(p) => area
          ? <textarea {...p} className={`input ${mr ? "mr" : ""}`} rows={3} value={v[k] ?? ""} disabled={!canEdit} onChange={(e) => set(k, e.target.value)} />
          : <input {...p} type={type} className={`input ${mr ? "mr" : ""}`} value={v[k] ?? ""} disabled={!canEdit}
              onChange={(e) => set(k, type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)} />}
      </Field>
    </div>
  );

  return (
    <>
      <PageHeader title="Award settings" crumbs={[AWARD_SECTION]}
        subtitle="Dates, limits and page content for the current award edition. Changes apply without a code deployment."
        actions={canEdit && <button type="button" className="btn btn--primary" onClick={save} disabled={saving}>{saving ? <Spinner /> : <Save size={15} />} Save all</button>} />
      <div className="settings">
        <section className="panel settings__section">
          <header className="panel__head">
            <div><h2>Nomination window</h2><p className="muted">Outside this window the website shows a notice and the API refuses nominations.</p></div>
            <Badge tone={wt}>{wl}</Badge>
          </header>
          <p className="muted small">Currently: {fmtDateTime(v.nomination_opens_at)} → {fmtDateTime(v.nomination_closes_at)} (IST){v.status?.forcedOpen && " · AWARD_FORCE_OPEN is set on the server"}</p>
          <div className="form-grid">
            <label className="switch form-grid__full">
              <input type="checkbox" checked={Boolean(v.nominations_enabled)} disabled={!canEdit} onChange={(e) => set("nominations_enabled", e.target.checked)} />
              <span className="switch__track" aria-hidden="true" /> Nominations enabled (master switch)
            </label>
            <div className="form-grid__half"><Field label="Opens (IST)" error={err("nomination_opens_at")}>{(p) => <input {...p} type="datetime-local" className="input" disabled={!canEdit} value={toIstInput(v.nomination_opens_at)} onChange={(e) => set("nomination_opens_at", fromIstInput(e.target.value))} />}</Field></div>
            <div className="form-grid__half"><Field label="Closes (IST)" error={err("nomination_closes_at")}>{(p) => <input {...p} type="datetime-local" className="input" disabled={!canEdit} value={toIstInput(v.nomination_closes_at)} onChange={(e) => set("nomination_closes_at", fromIstInput(e.target.value))} />}</Field></div>
            <div className="form-grid__half"><Field label="Scrutiny starts" error={err("scrutiny_starts_on")}>{(p) => <input {...p} type="date" className="input" disabled={!canEdit} value={v.scrutiny_starts_on ?? ""} onChange={(e) => set("scrutiny_starts_on", e.target.value || null)} />}</Field></div>
            <div className="form-grid__half"><Field label="Scrutiny ends" error={err("scrutiny_ends_on")}>{(p) => <input {...p} type="date" className="input" disabled={!canEdit} value={v.scrutiny_ends_on ?? ""} onChange={(e) => set("scrutiny_ends_on", e.target.value || null)} />}</Field></div>
            {text("closed_note", "Notice shown when nominations are closed (मराठी)", { area: true })}
            {text("closed_note_en", "Notice shown when nominations are closed (English)", { area: true, mr: false })}
          </div>
        </section>

        <section className="panel settings__section">
          <header className="panel__head"><h2>Award details</h2></header>
          <div className="form-grid">
            {text("year", "Award year", { type: "number", mr: false })}
            {text("reference_prefix", "Reference number prefix", { mr: false, hint: "e.g. ASBP26 → ASBP26-I-000001" })}
            {text("title", "Title (मराठी)", { area: true })}
            {text("title_en", "Title (English)", { area: true, mr: false })}
            {text("tagline", "Short description (मराठी)", { area: true })}
            {text("tagline_en", "Short description (English)", { area: true, mr: false })}
            {text("prize_individual", "Prize — individual category (मराठी)")}
            {text("prize_individual_en", "Prize — individual category (English)", { mr: false })}
            {text("prize_organization", "Prize — organization category (मराठी)")}
            {text("prize_organization_en", "Prize — organization category (English)", { mr: false })}
          </div>
        </section>

        <section className="panel settings__section">
          <header className="panel__head"><div><h2>Evidence uploads</h2><p className="muted">Accepted: PDF, JPG, PNG{v.allow_video ? ", MP4, WebM" : ""}. Files are validated on the server.</p></div></header>
          <div className="form-grid">
            {text("max_upload_mb", "Maximum file size (MB, 1–25)", { type: "number", mr: false })}
            {text("max_documents", "Maximum evidence entries per nomination (1–30)", { type: "number", mr: false })}
            <label className="switch form-grid__full">
              <input type="checkbox" checked={Boolean(v.allow_video)} disabled={!canEdit} onChange={(e) => set("allow_video", e.target.checked)} />
              <span className="switch__track" aria-hidden="true" /> Allow video files (MP4 / WebM)
            </label>
          </div>
        </section>

        <section className="panel settings__section">
          <header className="panel__head">
            <div><h2>Landing page content</h2><p className="muted">One item per line for lists. Empty English items fall back to the Marathi text on the website.</p></div>
            <div className="resource-tabs" role="tablist" aria-label="Content language">
              {[["content", "मराठी"], ["content_en", "English"]].map(([k, l]) => (
                <button key={k} type="button" role="tab" aria-selected={contentLang === k} className={`resource-tab ${contentLang === k ? "is-active" : ""}`} onClick={() => setContentLang(k)}>{l}</button>
              ))}
            </div>
          </header>
          <div className="form-grid">
            <div className="form-grid__full"><Field label="Introduction (परिचय)" error={err(`${ckey}.intro`)}>{(p) => <textarea {...p} className={`input ${ckey === "content" ? "mr" : ""}`} rows={5} disabled={!canEdit} value={c.intro ?? ""} onChange={(e) => setContent("intro", e.target.value)} />}</Field></div>
            {LISTS.map(([k, label]) => (
              <div key={k} className="form-grid__half">
                <Field label={label} error={Object.entries(errors).find(([ek]) => ek.startsWith(`${ckey}.${k}`))?.[1]}>
                  {(p) => <textarea {...p} className="input mr" rows={6} disabled={!canEdit} value={(c[k] ?? []).join("\n")} onChange={(e) => setContent(k, e.target.value.split("\n"))} />}
                </Field>
              </div>
            ))}
            <div className="form-grid__full"><Field label="Help text (मदत)">{(p) => <textarea {...p} className="input mr" rows={2} disabled={!canEdit} value={c.help ?? ""} onChange={(e) => setContent("help", e.target.value)} />}</Field></div>
            <div className="form-grid__full">
              <span className="label">FAQs</span>
              <div className="award-faq-edit">
                {(c.faqs ?? []).map((f, i) => (
                  <div key={i} className="award-faq-edit__row">
                    <input className="input mr" placeholder="Question" value={f.q} disabled={!canEdit} onChange={(e) => setContent("faqs", c.faqs.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} aria-label={`Question ${i + 1}`} />
                    <textarea className="input mr" rows={2} placeholder="Answer" value={f.a} disabled={!canEdit} onChange={(e) => setContent("faqs", c.faqs.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} aria-label={`Answer ${i + 1}`} />
                    {canEdit && <button type="button" className="icon-btn" aria-label={`Remove FAQ ${i + 1}`} onClick={() => setContent("faqs", c.faqs.filter((_, j) => j !== i))}><Trash2 size={15} /></button>}
                  </div>
                ))}
                {canEdit && <button type="button" className="btn btn--ghost btn--sm" onClick={() => setContent("faqs", [...(c.faqs ?? []), { q: "", a: "" }])}><Plus size={14} /> Add FAQ</button>}
              </div>
            </div>
          </div>
        </section>
        <p className="muted small">Committee members and previous winners are managed on their own pages: <Link to="/content/award-committee">Committee</Link> · <Link to="/content/award-winners">Previous winners</Link>.</p>
      </div>
    </>
  );
}
