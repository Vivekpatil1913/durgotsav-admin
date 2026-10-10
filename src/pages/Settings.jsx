import { AlertTriangle, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Field, ImageUpload, PageHeader, Spinner } from "../components/ui.jsx";
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

const SECTIONS = [
  {
    key: "registration", title: "Registration window", desc: "परिशिष्ट-अ §4. Outside this window the website shows a notice instead of the form.",
    fields: [
      ["enabled", "Registration enabled (master switch)", "boolean"],
      ["opens_at", "Opens (IST)", "ist"],
      ["closes_at", "Closes (IST)", "ist"],
      ["note", "Notice shown when registration is closed", "textarea"],
    ],
  },
  { key: "hero", title: "Home page hero", fields: [["eyebrow", "Eyebrow"], ["title", "Title"], ["subtitle", "Subtitle", "textarea"], ["image", "Background image", "image"]] },
  { key: "initiative", title: "Initiative details", fields: [["unesco_title", "UNESCO serial nomination title"], ["gr_reference", "Government resolution reference (मराठी)", "textarea"], ["gr_reference_en", "Government resolution reference (English)", "textarea"]] },
  { key: "world_record", title: "World record section", fields: [["enabled", "Show section", "boolean"], ["eyebrow", "Eyebrow"], ["title", "Title"], ["body", "Text", "textarea"], ["image", "Image", "image"]] },
  { key: "contact", title: "Contact & helpline", fields: [["email", "Email"], ["phone", "Phone"], ["whatsapp", "WhatsApp number", "text", "Digits with country code, e.g. 919112226154"], ["hours", "Helpline hours"], ["address", "Address (मराठी)", "textarea"], ["address_en", "Address (English)", "textarea"]] },
  { key: "social", title: "Social links", fields: [["instagram", "Instagram URL"], ["youtube", "YouTube URL"], ["facebook", "Facebook URL"], ["x", "X / Twitter URL"]] },
  { key: "seo", title: "SEO defaults", fields: [["site_name", "Site name"], ["default_title", "Default page title"], ["default_description", "Default meta description", "textarea"], ["og_image", "Social share image", "image"]] },
];

export default function Settings() {
  const { toast } = useUi();
  const [values, setValues] = useState(null);
  const [saving, setSaving] = useState(null);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    api.get("/admin/settings").then((r) => setValues(r.data.data)).catch((e) => toast(apiError(e).message, "error"));
  }, [toast]);

  const set = (section, key, v) => setValues((s) => ({ ...s, [section]: { ...s[section], [key]: v } }));

  async function save(section) {
    setSaving(section);
    setErrors({});
    try {
      const { data } = await api.put("/admin/settings", { [section]: values[section] });
      setValues(data.data);
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
  const closesYear = reg.closes_at ? new Date(reg.closes_at).getFullYear() : null;

  return (
    <>
      <PageHeader title="Settings" crumbs={["System"]} subtitle="Site-wide content and behaviour. Each section saves separately." />
      <div className="settings">
        {SECTIONS.map((sec) => (
          <section key={sec.key} className="panel settings__section" aria-labelledby={`set-${sec.key}`}>
            <header className="panel__head">
              <div>
                <h2 id={`set-${sec.key}`}>{sec.title}</h2>
                {sec.desc && <p className="muted">{sec.desc}</p>}
              </div>
              <button type="button" className="btn btn--primary btn--sm" onClick={() => save(sec.key)} disabled={saving === sec.key}>{saving === sec.key ? <Spinner /> : <Save size={14} />} Save</button>
            </header>
            {sec.key === "registration" && closesYear === 2027 && (
              <div className="alert alert--warning"><AlertTriangle size={16} /> Closing date is in 2027 exactly as printed in परिशिष्ट-अ (२५ नोव्हेंबर २०२७). Please confirm — it may be a typo for 2026.</div>
            )}
            {sec.key === "registration" && reg.opens_at && <p className="muted small">Currently: opens {fmtDateTime(reg.opens_at)}, closes {fmtDateTime(reg.closes_at)}</p>}
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
                  <div key={key} className={type === "ist" ? "form-grid__half" : "form-grid__full"}>
                    <Field label={label} error={err} hint={hint}>
                      {(p) => type === "textarea"
                        ? <textarea {...p} className="input mr" rows={3} value={v ?? ""} onChange={(e) => set(sec.key, key, e.target.value)} />
                        : type === "ist"
                          ? <input {...p} type="datetime-local" className="input" value={toIstInput(v)} onChange={(e) => set(sec.key, key, fromIstInput(e.target.value))} />
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
