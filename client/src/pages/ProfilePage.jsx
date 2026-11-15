import { useState } from "react";
import { api } from "../api.js";
import { Feedback } from "../components/Feedback.jsx";
import { PageHeader } from "../components/PageHeader.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function ProfilePage() {
  const { user, reloadUser } = useAuth();
  const [laundryDays, setLaundryDays] = useState(user?.laundryDays ?? []);
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

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

  function toggleDay(day) {
    setLaundryDays((current) => current.includes(day) ? current.filter((entry) => entry !== day) : [...current, day]);
  }

  return <>
    <PageHeader eyebrow="YOUR PREFERENCES" title="Make it your rhythm" description="A few small choices help Washday fit your routine." />
    <Feedback error={error} />
    {message && <div className="notice notice-success" role="status">{message}</div>}
    <div className="preferences-grid"><section className="panel preference-panel"><p className="eyebrow">YOUR WEEK</p><h2>When can you do laundry?</h2><p>Choose the days you can use your laundry room. You can change this whenever your routine changes.</p><form onSubmit={saveSchedule}><div className="weekday-grid">{days.map((day) => <label className={`weekday-option${laundryDays.includes(day) ? " chosen" : ""}`} key={day}><input type="checkbox" checked={laundryDays.includes(day)} onChange={() => toggleDay(day)} /><span>{day.slice(0, 3)}</span><i>{laundryDays.includes(day) ? "✓" : "＋"}</i></label>)}</div><button className="button button-primary" disabled={saving}>Save my schedule <span>→</span></button></form></section>
      <section className="panel preference-panel"><p className="eyebrow">ACCOUNT SECURITY</p><h2>Change password</h2><p>Choose a long passphrase that you do not use anywhere else.</p><form className="form-stack" onSubmit={updatePassword}><label>Current password<input type="password" autoComplete="current-password" maxLength="72" value={passwords.currentPassword} onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })} required /></label><label>New password<input type="password" autoComplete="new-password" minLength="12" maxLength="72" value={passwords.newPassword} onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })} required /></label><label>Confirm new password<input type="password" autoComplete="new-password" minLength="12" maxLength="72" value={passwords.confirmPassword} onChange={(event) => setPasswords({ ...passwords, confirmPassword: event.target.value })} required /></label><button className="button button-outline" disabled={saving}>Update password</button></form><small className="privacy-note">Your account uses an HTTP-only session cookie. Your password is never sent back to the browser after sign-in.</small></section></div>
  </>;
}
