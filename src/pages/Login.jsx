import { AlertCircle, LogIn } from "lucide-react";
import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Field, Spinner } from "../components/ui.jsx";
import { EDITION_YEAR } from "../config/edition.js";
import { useAuth } from "../context/AuthContext.jsx";
import { apiError } from "../lib/api.js";

export default function Login() {
  const { admin, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (admin) return <Navigate to={location.state?.from || "/"} replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email.trim(), password);
      navigate(location.state?.from || "/", { replace: true });
    } catch (err) {
      setError(apiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="login__art" aria-hidden="true">
        <img src="/logo.webp" alt="" width="180" height="180" />
        <p>चला, दुर्ग बनवूया!</p>
      </div>
      <form className="login__card" onSubmit={submit}>
        <h1>Sign in</h1>
        <p className="muted">Amrut Durgotsav {EDITION_YEAR} · Admin console</p>
        {error && <div className="alert alert--error" role="alert"><AlertCircle size={16} /> {error}</div>}
        <Field label="Email" required>
          {(p) => <input {...p} className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />}
        </Field>
        <Field label="Password" required>
          {(p) => <input {...p} className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />}
        </Field>
        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>{busy ? <Spinner /> : <LogIn size={16} />} Sign in</button>
        <small className="muted">Access is logged. Contact a super admin if you need an account.</small>
      </form>
    </div>
  );
}
