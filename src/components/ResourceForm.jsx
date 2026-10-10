import { Plus, Trash2 } from "lucide-react";
import { Field, ImageUpload } from "./ui.jsx";

const toLocalInput = (v) => {
  if (!v) return "";
  const d = new Date(v);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export function initialValues(fields, record) {
  return Object.fromEntries(
    fields.filter((f) => f.type !== "readonly").map((f) => {
      let v = record ? record[f.key] : f.default;
      if (f.type === "password") v = "";
      if (f.type === "datetime") v = toLocalInput(v);
      if (f.type === "facts") v = v ?? [];
      return [f.key, v ?? (f.type === "boolean" ? false : "")];
    }),
  );
}

// Converts form strings into API types; empty optional values become null
export function toPayload(fields, values, isEdit) {
  const out = {};
  for (const f of fields) {
    if (f.type === "readonly") continue;
    let v = values[f.key];
    if (f.type === "password") {
      if (!v) continue;
    } else if (f.type === "number") v = v === "" || v == null ? null : Number(v);
    else if (f.type === "datetime") v = v ? new Date(v).toISOString() : null;
    else if (f.type === "facts") v = (v || []).filter((x) => x.label?.trim() && x.value?.trim());
    else if (typeof v === "string") v = v.trim() === "" ? (f.required ? "" : null) : v;
    if (f.key === "slug" && !v && !isEdit) continue;
    out[f.key] = v;
  }
  return out;
}

export function ResourceForm({ fields, values, onChange, errors, record }) {
  const set = (k, v) => onChange({ ...values, [k]: v });
  return (
    <div className="form-grid">
      {fields.map((f) => {
        const err = errors[f.key];
        const cls = f.half ? "form-grid__half" : "form-grid__full";
        if (f.type === "readonly") {
          return record?.[f.key] ? (
            <div key={f.key} className={`${cls} readonly`}><span>{f.label}</span><p className={f.mr ? "mr" : ""}>{record[f.key]}</p></div>
          ) : null;
        }
        if (f.type === "boolean") {
          return (
            <label key={f.key} className={`${cls} switch`}>
              <input type="checkbox" checked={Boolean(values[f.key])} onChange={(e) => set(f.key, e.target.checked)} />
              <span className="switch__track" aria-hidden="true" />
              {f.label}
            </label>
          );
        }
        if (f.type === "image") {
          return (
            <div key={f.key} className={cls}>
              <span className="label">{f.label}</span>
              <ImageUpload value={values[f.key]} folder={f.folder} label={f.label} onChange={(v) => set(f.key, v)} />
              {err && <small className="field__error">{err}</small>}
            </div>
          );
        }
        if (f.type === "facts") {
          const facts = values[f.key] || [];
          const update = (i, k, v) => set(f.key, facts.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
          return (
            <fieldset key={f.key} className={`${cls} facts`}>
              <legend className="label">{f.label}</legend>
              {facts.map((x, i) => (
                <div key={i} className="facts__row">
                  <input className="input mr" placeholder="Label (e.g. जिल्हा)" value={x.label} onChange={(e) => update(i, "label", e.target.value)} aria-label={`Fact ${i + 1} label`} />
                  <input className="input mr" placeholder="Value" value={x.value} onChange={(e) => update(i, "value", e.target.value)} aria-label={`Fact ${i + 1} value`} />
                  <button type="button" className="icon-btn icon-btn--danger" onClick={() => set(f.key, facts.filter((_, j) => j !== i))} aria-label="Remove fact"><Trash2 size={15} /></button>
                </div>
              ))}
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => set(f.key, [...facts, { label: "", value: "" }])}><Plus size={14} /> Add fact</button>
            </fieldset>
          );
        }
        return (
          <div key={f.key} className={cls}>
            <Field label={f.label} required={f.required} error={err} hint={f.hint}>
              {(p) => {
                const common = { ...p, className: `input ${f.mr ? "mr" : ""}`, value: values[f.key] ?? "", onChange: (e) => set(f.key, e.target.value) };
                if (f.type === "textarea" || f.type === "markdown") return <textarea {...common} rows={f.rows || (f.type === "markdown" ? 14 : 4)} className={`${common.className} ${f.type === "markdown" ? "input--code" : ""}`} />;
                if (f.type === "select") return <select {...common}>{f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>;
                const type = { number: "number", date: "date", datetime: "datetime-local", password: "password" }[f.type] || "text";
                return <input {...common} type={type} step={f.step} autoComplete={f.type === "password" ? "new-password" : undefined} />;
              }}
            </Field>
          </div>
        );
      })}
    </div>
  );
}
