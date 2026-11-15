import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { EmptyState, Feedback, LoadingState } from "../components/Feedback.jsx";
import { PageHeader } from "../components/PageHeader.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const tiles = [
  ["total", "Pieces in your closet", "#"],
  ["available", "Ready to wear", "✓"],
  ["inLaundry", "In the wash", "◌"],
  ["missing", "To keep an eye on", "⌕"],
];

export function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api.get("/dashboard/stats").then((result) => setStats(result.stats)).catch((requestError) => setError(requestError.message));
  }, []);

  return <>
    <PageHeader eyebrow="YOUR LAUNDRY SPACE" title={`A fresh start, ${user?.username}.`} description="Here's a little snapshot of where your laundry stands." action={<Link className="button button-primary" to="/closet">Add an item <span>＋</span></Link>} />
    <Feedback error={error} />
    {!stats && !error ? <LoadingState label="Gathering your laundry stats…" /> : null}
    {stats && <div className="stats-grid">{tiles.map(([key, label, icon], index) => <article className={`stat-card stat-${index + 1}`} key={key}><div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div><strong>{stats[key]}</strong><small>{key === "inLaundry" ? "out for a wash" : key === "missing" ? "marked missing" : key === "available" ? "ready when you are" : "in your personal closet"}</small></article>)}</div>}
    <section className="dashboard-lower"><div className="panel routine-panel"><div className="panel-heading"><div><p className="eyebrow">YOUR ROUTINE</p><h2>Make laundry day yours</h2></div><span className="panel-illustration">◷</span></div><p>Pick the days that suit your hostel or household schedule. Washday will keep them in view when you plan a cycle.</p><div className="routine-days">{(user?.laundryDays ?? []).length ? user.laundryDays.map((day) => <span key={day}>{day.slice(0, 3)}</span>) : <span>No days selected</span>}</div><Link className="inline-link" to="/profile">Update your days <span>→</span></Link></div><div className="panel next-panel"><p className="eyebrow">NEXT STEP</p><h2>Keep your closet current</h2><p>Add a few everyday pieces, then use laundry history to remember what's still away.</p><Link className="button button-light" to="/laundry">View laundry <span>→</span></Link><span className="next-art" aria-hidden="true">〰</span></div></section>
    {stats?.total === 0 && <div className="panel empty-panel"><EmptyState icon="▤" title="Your closet starts here" description="Add the clothes you wear most to make your dashboard useful." action={<Link className="button button-primary" to="/closet">Add your first item</Link>} /></div>}
  </>;
}
