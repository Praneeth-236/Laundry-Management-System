import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { Feedback } from "../components/Feedback.jsx";

function RecoveryCard({ eyebrow, title, description, children }) {
  return <main className="auth-page"><Link className="brand auth-brand" to="/"><span className="brand-mark">w</span><span>Washday</span></Link><section className="auth-card"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="auth-description">{description}</p>{children}<p className="auth-switch"><Link to="/login">Back to sign in</Link></p></section></main>;
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError(""); setMessage(""); setSaving(true);
    try {
      const result = await api.post("/auth/password-reset/request", { email });
      setMessage(result.message);
    } catch (requestError) { setError(requestError.message); }
    finally { setSaving(false); }
  }

  return <RecoveryCard eyebrow="ACCOUNT RECOVERY" title="Reset your password" description="Enter the verified recovery email for your Washday account. If it matches, we will send a one-time link.">
    <Feedback error={error} />{message && <div className="notice notice-success" role="status">{message}</div>}
    <form className="form-stack" onSubmit={submit}><label>Email<input type="email" autoComplete="email" maxLength="254" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><button className="button button-primary button-wide" disabled={saving}>{saving ? "Please wait..." : "Send reset link"}</button></form>
  </RecoveryCard>;
}

export function VerifyEmailPage() {
  const [state, setState] = useState({ loading: true, error: "", message: "" });
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = window.location.hash.slice(1);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
    if (!token) { setState({ loading: false, error: "This verification link is missing its token.", message: "" }); return; }
    api.post("/auth/email/verification/confirm", { token }).then((result) => {
      setState({ loading: false, error: "", message: result.message });
    }).catch((requestError) => setState({ loading: false, error: requestError.message, message: "" }));
  }, []);
  return <RecoveryCard eyebrow="EMAIL VERIFICATION" title="Verify your email" description="This confirms that you can access the address linked to your Washday account.">
    {state.loading ? <p role="status">Checking your verification link...</p> : <><Feedback error={state.error} />{state.message && <div className="notice notice-success" role="status">{state.message}</div>}</>}
  </RecoveryCard>;
}

export function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const tokenStarted = useRef(false);
  useEffect(() => {
    if (tokenStarted.current) return;
    tokenStarted.current = true;
    const value = window.location.hash.slice(1);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
    setToken(value);
  }, []);
  const [form, setForm] = useState({ newPassword: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError(""); setMessage(""); setSaving(true);
    try {
      const result = await api.post("/auth/password-reset/complete", { token, ...form });
      setMessage(result.message);
      setForm({ newPassword: "", confirmPassword: "" });
    } catch (requestError) { setError(requestError.message); }
    finally { setSaving(false); }
  }

  return <RecoveryCard eyebrow="ACCOUNT RECOVERY" title="Choose a new password" description="Use a long passphrase you do not use on another site. The reset link works once and expires after 30 minutes.">
    <Feedback error={!token ? "This reset link is missing its token." : error} />{message && <div className="notice notice-success" role="status">{message}</div>}
    {token && !message && <form className="form-stack" onSubmit={submit}><label>New password<input type="password" autoComplete="new-password" minLength="12" maxLength="72" value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} required /></label><label>Confirm new password<input type="password" autoComplete="new-password" minLength="12" maxLength="72" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} required /></label><button className="button button-primary button-wide" disabled={saving}>{saving ? "Please wait..." : "Update password"}</button></form>}
  </RecoveryCard>;
}
