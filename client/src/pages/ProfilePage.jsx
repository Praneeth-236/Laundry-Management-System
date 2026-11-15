import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { Feedback } from "../components/Feedback.jsx";
import { PageHeader } from "../components/PageHeader.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function ProfilePage() {
  const { user, reloadUser } = useAuth();
  const navigate = useNavigate();
  const [laundryDays, setLaundryDays] = useState(user?.laundryDays ?? []);
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [recoveryEmail, setRecoveryEmail] = useState(user?.email ?? "");
  const [emailPassword, setEmailPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");

  async function saveSchedule(event) {
    event.preventDefault();
    setSaving(true); setError(""); setMessage("");
    try {
      await api.patch("/profile/schedule", { laundryDays });
      await reloadUser();
      setMessage("Your laundry days are saved.");
    } catch (requestError) { setError(requestError.message); }
    finally { setSaving(false); }
  }

  async function updatePassword(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSaving(true); setError(""); setMessage("");
    try {
      const result = await api.patch("/profile/password", passwords);
      setMessage(result.message);
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
      formElement.reset();
    } catch (requestError) { setError(requestError.message); }
    finally { setSaving(false); }
  }

  async function saveRecoveryEmail(event) {
    event.preventDefault();
    setSaving(true); setError(""); setMessage("");
    try {
      const result = await api.patch("/profile/email", { email: recoveryEmail, currentPassword: emailPassword });
      await reloadUser();
      setEmailPassword("");
      setMessage(result.message);
    } catch (requestError) { setError(requestError.message); }
    finally { setSaving(false); }
  }

  async function resendVerification() {
    setSaving(true); setError(""); setMessage("");
    try {
      const result = await api.post("/auth/email/verification/request", {});
      setMessage(result.message);
    } catch (requestError) { setError(requestError.message); }
    finally { setSaving(false); }
  }

  async function downloadExport() {
    setSaving(true); setError(""); setMessage("");
    try {
      const data = await api.get("/profile/export");
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url; link.download = "washday-account-export.json"; link.click();
      URL.revokeObjectURL(url);
      setMessage("Your account export has been downloaded.");
    } catch (requestError) { setError(requestError.message); }
    finally { setSaving(false); }
  }

  async function deleteAccount(event) {
    event.preventDefault();
    if (!window.confirm("Permanently delete your Washday account, inventory, photos, and laundry history? This cannot be undone.")) return;
    setSaving(true); setError(""); setMessage("");
    try {
      await api.delete("/profile/account", { currentPassword: deletePassword });
      await reloadUser();
      navigate("/login", { replace: true });
    } catch (requestError) { setError(requestError.message); }
    finally { setSaving(false); }
  }

  function toggleDay(day) {
    setLaundryDays((current) => current.includes(day) ? current.filter((entry) => entry !== day) : [...current, day]);
  }

  return <>
    <PageHeader eyebrow="YOUR PREFERENCES" title="Make it your rhythm" description="A few small choices help Washday fit your routine." />
    <Feedback error={error} />
    {message && <div className="notice notice-success" role="status">{message}</div>}
    <div className="preferences-grid"><section className="panel preference-panel"><p className="eyebrow">YOUR WEEK</p><h2>When can you do laundry?</h2><p>Choose the days you can use your laundry room. You can change this whenever your routine changes.</p><form onSubmit={saveSchedule}><div className="weekday-grid">{days.map((day) => <label className={`weekday-option${laundryDays.includes(day) ? " chosen" : ""}`} key={day}><input type="checkbox" checked={laundryDays.includes(day)} onChange={() => toggleDay(day)} /><span>{day.slice(0, 3)}</span><i>{laundryDays.includes(day) ? "✓" : "＋"}</i></label>)}</div><button className="button button-primary" disabled={saving}>Save my schedule <span>→</span></button></form></section>
      <section className="panel preference-panel"><p className="eyebrow">ACCOUNT SECURITY</p><h2>Recovery email</h2><p>{user?.email ? (user.emailVerified ? "Your recovery address is verified." : "Verify this address before using password recovery.") : "Add an email address so you can recover your account."}</p><form className="form-stack" onSubmit={saveRecoveryEmail}><label>Email<input type="email" autoComplete="email" maxLength="254" value={recoveryEmail} onChange={(event) => setRecoveryEmail(event.target.value)} required /></label><label>Confirm with your current password<input type="password" autoComplete="current-password" maxLength="72" value={emailPassword} onChange={(event) => setEmailPassword(event.target.value)} required /></label><button className="button button-outline" disabled={saving}>Save recovery email</button></form>{user?.email && !user.emailVerified && <button type="button" className="button button-outline" onClick={resendVerification} disabled={saving}>Send verification email again</button>}</section>
      <section className="panel preference-panel"><p className="eyebrow">ACCOUNT SECURITY</p><h2>Change password</h2><p>Choose a long passphrase that you do not use anywhere else.</p><form className="form-stack" onSubmit={updatePassword}><label>Current password<input type="password" autoComplete="current-password" maxLength="72" value={passwords.currentPassword} onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })} required /></label><label>New password<input type="password" autoComplete="new-password" minLength="12" maxLength="72" value={passwords.newPassword} onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })} required /></label><label>Confirm new password<input type="password" autoComplete="new-password" minLength="12" maxLength="72" value={passwords.confirmPassword} onChange={(event) => setPasswords({ ...passwords, confirmPassword: event.target.value })} required /></label><button className="button button-outline" disabled={saving}>Update password</button></form><small className="privacy-note">Your account uses an HTTP-only session cookie. Your password is never sent back to the browser after sign-in.</small></section></div>
    <section className="panel preference-panel account-data-panel"><p className="eyebrow">YOUR DATA</p><h2>Export or delete your account</h2><p>Download a JSON copy of your account, clothing inventory, and laundry history. Deleting your account permanently removes those records and stored clothing photos.</p><button className="button button-outline" onClick={downloadExport} disabled={saving}>Download my data</button><form className="form-stack delete-account-form" onSubmit={deleteAccount}><label>Confirm with your current password<input type="password" autoComplete="current-password" maxLength="256" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} required /></label><button className="button button-danger" disabled={saving}>Permanently delete my account</button></form></section>
  </>;
}
