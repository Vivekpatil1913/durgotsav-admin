import { KeyRound } from "lucide-react";
import { useState } from "react";
import { Field, PageHeader, Spinner } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useUi } from "../context/UiContext.jsx";
import { api, apiError } from "../lib/api.js";
import { ROLES } from "../lib/format.js";

export default function Profile() {
  const { admin } = useAuth();
  const { toast } = useUi();
  const [v, setV] = useState({ current_password: "", new_password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (v.new_password !== v.confirm) return setErrors({ confirm: "Passwords do not match" });
    setBusy(true);
    setErrors({});
    try {
      await api.post("/auth/change-password", { current_password: v.current_password, new_password: v.new_password });
      toast("Password changed");
      setV({ current_password: "", new_password: "", confirm: "" });
    } catch (err) {
      const x = apiError(err);
      setErrors(x.details || {});
      toast(x.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="My account" subtitle={`${admin.name} · ${admin.email} · ${ROLES[admin.role]}`} />
      <form className="panel narrow stack" onSubmit={submit}>
        <h2 className="sub-title">Change password</h2>
        {[["current_password", "Current password", "current-password"], ["new_password", "New password", "new-password"], ["confirm", "Confirm new password", "new-password"]].map(([k, label, ac]) => (
          <Field key={k} label={label} required error={errors[k]} hint={k === "new_password" ? "At least 10 characters, with a letter and a number" : undefined}>
            {(p) => <input {...p} className="input" type="password" autoComplete={ac} value={v[k]} onChange={(e) => setV((s) => ({ ...s, [k]: e.target.value }))} required />}
          </Field>
        ))}
        <div><button type="submit" className="btn btn--primary" disabled={busy}>{busy ? <Spinner /> : <KeyRound size={16} />} Update password</button></div>
      </form>
    </>
  );
}
