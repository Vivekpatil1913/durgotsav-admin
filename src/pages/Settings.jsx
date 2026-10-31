import { AlertTriangle, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge, Field, ImageUpload, PageHeader, Spinner } from "../components/ui.jsx";
import { EDITION_YEAR } from "../config/edition.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useUi } from "../context/UiContext.jsx";
import { api, apiError } from "../lib/api.js";
import { fmtDateTime } from "../lib/format.js";

// Registration dates are entered and shown in IST regardless of the admin's computer time zone
const toIstInput = (iso) => {
  if (!iso) return "";
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};
const fromIstInput = (v) => (v ? `${v}:00+05:30` : "");
const istDay = (iso) => toIstInput(iso).slice(0, 10);
// A date outside the edition year is usually last year's value left unchanged
const offEdition = (...values) => values.some((v) => v && Number(istDay(v).slice(0, 4)) !== EDITION_YEAR);
// The public site shows {year} as the edition year, so such text needs no yearly edits
const YEAR_HINT = `Write {year} for the edition year (${EDITION_YEAR}) — it updates by itself next year`;

const SECTIONS = [
  {
    key: "registration", title: "Registration dates & notice", desc: "परिशिष्ट-अ §4. Shown on the website. These dates do not open or close the form — only the Registration form switch above does.",
    fields: [
      ["opens_at", "Opens (IST)", "ist"],
      ["closes_at", "Closes (IST)", "ist"],
      ["note", "Notice shown when registration is closed", "textarea"],
    ],
  },
  {
    key: "important_dates", title: "Important dates", desc: "Dates on the home page timeline cards. Display only — the Registration form switch at the top opens and closes the form.",
    fields: [
      ["festival_begins", "Durgotsav Shubharambh (festival begins)", "date"],
      ["upload_opens", "Photo upload start", "date"],
      ["upload_closes", "Photo upload deadline", "date"],
    ],
  },
  { key: "hero", title: "Home page hero", fields: [["eyebrow", "Eyebrow"], ["title", "Title", "text", YEAR_HINT], ["subtitle", "Subtitle", "textarea"], ["image", "Background image", "image"]] },
  { key: "initiative", title: "Initiative details", fields: [["unesco_title", "UNESCO serial nomination title"], ["gr_reference", "Government resolution reference (मराठी)", "textarea"], ["gr_reference_en", "Government resolution reference (English)", "textarea"]] },
  { key: "world_record", title: "World record section", fields: [["enabled", "Show section", "boolean"], ["eyebrow", "Eyebrow"], ["title", "Title"], ["body", "Text", "textarea", YEAR_HINT], ["image", "Image", "image"]] },
  { key: "contact", title: "Contact & helpline", fields: [["email", "Email"], ["phone", "Phone"], ["whatsapp", "WhatsApp number", "text", "Digits with country code, e.g. 919112226154"], ["hours", "Helpline hours"], ["address", "Address (मराठी)", "textarea"], ["address_en", "Address (English)", "textarea"]] },
  { key: "social", title: "Social links", fields: [["instagram", "Instagram URL"], ["youtube", "YouTube URL"], ["facebook", "Facebook URL"], ["linkedin", "LinkedIn URL"], ["google", "Google profile URL"], ["x", "X / Twitter URL"]] },
  { key: "seo", title: "SEO defaults", fields: [["site_name", "Site name", "text", YEAR_HINT], ["default_title", "Default page title", "text", YEAR_HINT], ["default_description", "Default meta description", "textarea"], ["og_image", "Social share image", "image"]] },
];

export default function Settings() {
  const { toast, confirm } = useUi();
  const canEdit = useAuth().hasPermission("settings", "write");
  const [values, setValues] = useState(null);
  const [meta, setMeta] = useState({});
  const [saving, setSaving] = useState(null);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    api.get("/admin/settings").then((r) => { setValues(r.data.data); setMeta(r.data.meta ?? {}); }).catch((e) => toast(apiError(e).message, "error"));
  }, [toast]);

  const set = (section, key, v) => setValues((s) => ({ ...s, [section]: { ...s[section], [key]: v } }));

  // Saves on its own as soon as it is confirmed, so unsaved edits in the sections below are kept
  async function toggleRegistration(next) {
    const ok = await confirm(next
      ? { title: "Open registration?", message: "The registration form opens on the website for everyone right away, whatever the dates below say. It stays open until you turn this switch off.", confirmLabel: "Open registration", tone: "primary" }
      : { title: "Close registration?", message: "The website shows the closed notice below instead of the form, whatever the dates say. Registrations already submitted are kept.", confirmLabel: "Close registration", tone: "danger" });
    if (!ok) return;
    setSaving("registration_force_open");
    try {
      const { data } = await api.put("/admin/settings", { registration_force_open: next });
      setValues((s) => ({ ...s, registration_force_open: data.data.registration_force_open }));
      setMeta(data.meta ?? {});
      toast(next ? "Registration opened — the website updates within a minute" : "Registration closed — the website updates within a minute");
    } catch (err) {
      toast(apiError(err).message, "error");
    } finally {
      setSaving(null);
    }
  }

  async function save(section) {
    setSaving(section);
    setErrors({});
    try {
      const { data } = await api.put("/admin/settings", { [section]: values[section] });
      setValues(data.data);
      setMeta(data.meta ?? {});
      toast("Settings saved — the website updates within a minute");
    } catch (err) {
      const e = apiError(err);
      setErrors(e.details || {});
      toast(e.message, "error");
    } finally {
      setSaving(null);
    }
  }

  if (!values) return <div className="page-loading"><Spinner size={22} /></div>;
  const reg = values.registration ?? {};
  const dates = values.important_dates ?? {};
  const datesMismatch = Boolean(reg.opens_at && reg.closes_at && dates.upload_opens && dates.upload_closes)
    && (istDay(reg.opens_at) !== dates.upload_opens || istDay(reg.closes_at) !== dates.upload_closes);
  const formOn = values.registration_force_open === true;
  const status = meta.registration_status;
  const [statusLabel, statusTone] = !status ? ["—", "neutral"] : status.open ? ["Open now", "success"] : ["Closed", "danger"];

  return (
    <>
      <PageHeader title="Settings" crumbs={["System"]} subtitle="Site-wide content and behaviour. Each section saves separately." />
      <div className="settings">
        <section className="panel settings__section" aria-labelledby="set-registration-form">
          <header className="panel__head">
            <div>
              <h2 id="set-registration-form">Registration form</h2>
              <p className="muted">On: the form is open on the website. Off: it is closed and the website shows the notice below. Only this switch opens and closes it — the dates below don't. Saves as soon as you confirm.</p>
            </div>
            <Badge tone={statusTone}>Registration: {statusLabel}</Badge>
          </header>
          {meta.registration_force_open_env && (
            <div className="alert alert--warning"><AlertTriangle size={16} /> REGISTRATION_FORCE_OPEN=true is set in the server .env, so registration stays open whatever this switch says. Set it to false and restart the API to control it from here.</div>
          )}
          <label className="switch">
            <input type="checkbox" checked={formOn} disabled={!canEdit || saving === "registration_force_open"} onChange={(e) => toggleRegistration(e.target.checked)} />
            <span className="switch__track" aria-hidden="true" /> {formOn ? "On — the form is open on the website" : "Off — the form is closed (the website shows the notice below)"}
            {saving === "registration_force_open" && <Spinner />}
          </label>
        </section>
        {SECTIONS.map((sec) => (
          <section key={sec.key} className="panel settings__section" aria-labelledby={`set-${sec.key}`}>
            <header className="panel__head">
              <div>
                <h2 id={`set-${sec.key}`}>{sec.title}</h2>
                {sec.desc && <p className="muted">{sec.desc}</p>}
              </div>
              <button type="button" className="btn btn--primary btn--sm" onClick={() => save(sec.key)} disabled={saving === sec.key}>{saving === sec.key ? <Spinner /> : <Save size={14} />} Save</button>
            </header>
            {sec.key === "registration" && offEdition(reg.opens_at, reg.closes_at) && (
              <div className="alert alert--warning"><AlertTriangle size={16} /> The registration dates are not in {EDITION_YEAR}, the current edition. Please check them.</div>
            )}
            {sec.key === "registration" && reg.opens_at && <p className="muted small">Currently: opens {fmtDateTime(reg.opens_at)}, closes {fmtDateTime(reg.closes_at)}</p>}
            {sec.key === "important_dates" && offEdition(dates.festival_begins, dates.upload_opens, dates.upload_closes) && (
              <div className="alert alert--warning"><AlertTriangle size={16} /> Some dates are not in {EDITION_YEAR}, the current edition. Please check them.</div>
            )}
            {sec.key === "important_dates" && datesMismatch && (
              <div className="alert alert--warning"><AlertTriangle size={16} /> Upload dates differ from the registration dates ({fmtDateTime(reg.opens_at)} → {fmtDateTime(reg.closes_at)}). The website shows both, so keep them the same.</div>
            )}
            <div className="form-grid">
              {sec.fields.map(([key, label, type = "text", hint]) => {
                const v = values[sec.key]?.[key];
                const err = errors[`${sec.key}.${key}`];
                if (type === "boolean") {
                  return (
                    <label key={key} className="switch form-grid__full">
                      <input type="checkbox" checked={Boolean(v)} onChange={(e) => set(sec.key, key, e.target.checked)} />
                      <span className="switch__track" aria-hidden="true" /> {label}
                    </label>
                  );
                }
                if (type === "image") {
                  return (
                    <div key={key} className="form-grid__full">
                      <span className="label">{label}</span>
                      <ImageUpload value={v} folder="content" label={label} onChange={(url) => set(sec.key, key, url ?? "")} />
                    </div>
                  );
                }
                return (
                  <div key={key} className={type === "ist" || type === "date" ? "form-grid__half" : "form-grid__full"}>
                    <Field label={label} error={err} hint={hint}>
                      {(p) => type === "textarea"
                        ? <textarea {...p} className="input mr" rows={3} value={v ?? ""} onChange={(e) => set(sec.key, key, e.target.value)} />
                        : type === "ist"
                          ? <input {...p} type="datetime-local" className="input" value={toIstInput(v)} onChange={(e) => set(sec.key, key, fromIstInput(e.target.value))} />
                          : type === "date"
                            ? <input {...p} type="date" className="input" value={v ?? ""} onChange={(e) => set(sec.key, key, e.target.value)} />
                            : <input {...p} className="input mr" value={v ?? ""} onChange={(e) => set(sec.key, key, e.target.value)} />}
                    </Field>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
