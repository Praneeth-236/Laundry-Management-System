import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import { EmptyState, Feedback, LoadingState } from "../components/Feedback.jsx";
import { PageHeader } from "../components/PageHeader.jsx";

export function LaundryPage() {
  const [overview, setOverview] = useState(null);
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadOverview = useCallback(async () => setOverview(await api.get("/laundry")), []);
  useEffect(() => {
    loadOverview().catch((requestError) => setError(requestError.message)).finally(() => setLoading(false));
  }, [loadOverview]);

  const canSubmit = overview?.canSubmit ?? false;
  const selectedSet = new Set(selected);

  function toggleItem(id) {
    setSelected((current) => current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id]);
  }

  async function sendCycle(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.post("/laundry", { itemIds: selected });
      setSelected([]);
      await loadOverview();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function finish(eventId, outcome) {
    setError("");
    try {
      await api.post(`/laundry/${eventId}/${outcome}`, {});
      await loadOverview();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return <>
    <PageHeader eyebrow="WASH, RETURN, REPEAT" title="Laundry" description="Keep the journey of each piece clear, from wash day to wardrobe." />
    <Feedback error={error} onDismiss={() => setError("")} />
    {loading ? <LoadingState label="Checking what's ready…" /> : <div className="laundry-layout">
      <section className="panel cycle-panel"><div className="section-title"><div><p className="eyebrow">START A CYCLE</p><h2>What are we washing?</h2></div><span className="cycle-orbit">◌</span></div>
        <div className="schedule-note"><span className="schedule-symbol">◷</span><div><strong>Your laundry days</strong><div className="day-chips">{overview.laundryDays.length ? overview.laundryDays.map((day) => <span key={day}>{day}</span>) : <small>Choose days in Preferences</small>}</div></div></div>
        {!canSubmit && <p className="notice notice-warn">Today is {overview.currentDay}. Your schedule is set for other days.</p>}
        {overview.availableItems.length ? <form onSubmit={sendCycle}><div className="select-list">{overview.availableItems.map((item) => <label className={`select-item${selectedSet.has(item._id) ? " selected" : ""}`} key={item._id}><input type="checkbox" checked={selectedSet.has(item._id)} onChange={() => toggleItem(item._id)} disabled={!canSubmit} /><span className="check-visual">✓</span><span className="select-item-copy"><strong>{item.name}</strong><small>{item.category}</small></span><span className="status-dot" /></label>)}</div><button className="button button-primary button-wide" disabled={!canSubmit || selected.length === 0 || busy}>{busy ? "Saving cycle…" : `Send ${selected.length || "selected"} ${selected.length === 1 ? "piece" : "pieces"} to laundry`}<span>→</span></button></form> : <EmptyState icon="✓" title="Nothing waiting to wash" description="Your available clothes will show up here." />}
      </section>
      <section className="panel history-panel"><div className="section-title"><div><p className="eyebrow">YOUR RECORD</p><h2>Recent cycles</h2></div><span className="history-count">{overview.history.length}</span></div>
        {!overview.history.length ? <EmptyState icon="◷" title="Your story starts here" description="The items you send to laundry will be recorded here." /> : <ol className="history-list">{overview.history.map((event) => <li className="history-row" key={event._id}><span className={`history-marker marker-${event.status}`} /><div className="history-copy"><div className="history-row-top"><strong>{event.item?.name ?? "Archived item"}</strong><span className={`status-pill status-${event.status}`}>{event.status === "pending" ? "In the wash" : event.status}</span></div><small>{event.item?.category} · Sent {new Date(event.sentAt).toLocaleDateString()}{event.returnedAt ? ` · Returned ${new Date(event.returnedAt).toLocaleDateString()}` : ""}</small>{event.status === "pending" && <div className="history-actions"><button className="text-button success-text" onClick={() => finish(event._id, "return")}>Mark returned</button><button className="text-button danger-text" onClick={() => finish(event._id, "missing")}>Report missing</button></div>}</div></li>)}</ol>}
      </section>
    </div>}
  </>;
}
