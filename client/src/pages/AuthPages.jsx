import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Feedback } from "../components/Feedback.jsx";
import { useAuth } from "../context/AuthContext.jsx";

function AuthCard({ mode }) {
  const isSignup = mode === "signup";
  const { user, isLoading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  if (!isLoading && user) return <Navigate to="/dashboard" replace />;

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await (isSignup ? signUp(form) : signIn(form));
      navigate("/dashboard");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="auth-page"><Link className="brand auth-brand" to="/"><span className="brand-mark">w</span><span>Washday</span></Link>
      <section className="auth-card"><span className="auth-spark">✳</span><p className="eyebrow">{isSignup ? "A FRESH START" : "WELCOME BACK"}</p><h1>{isSignup ? "Make room for less laundry stress." : "Good to see you again."}</h1><p className="auth-description">{isSignup ? "Create your personal laundry space in a minute." : "Sign in to pick up where you left off."}</p>
        <Feedback error={error} />
        <form onSubmit={submit} className="form-stack">
          <label>Username<input autoComplete="username" minLength="3" maxLength="20" pattern="[A-Za-z0-9_]+" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} required /></label>
          <label>Password<input type="password" autoComplete={isSignup ? "new-password" : "current-password"} minLength={isSignup ? "12" : undefined} maxLength="72" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />{isSignup && <small>Use 12–72 characters. A memorable passphrase works well.</small>}</label>
          <button className="button button-primary button-wide" disabled={saving}>{saving ? "Please wait…" : isSignup ? "Create my account" : "Sign in"}<span>↗</span></button>
        </form>
        <p className="auth-switch">{isSignup ? "Already have a space?" : "New to Washday?"} <Link to={isSignup ? "/login" : "/signup"}>{isSignup ? "Sign in" : "Create an account"}</Link></p>
      </section>
      <p className="auth-footnote">A calmer laundry routine starts here.</p>
    </main>
  );
}

export function LoginPage() { return <AuthCard mode="login" />; }
export function SignupPage() { return <AuthCard mode="signup" />; }
