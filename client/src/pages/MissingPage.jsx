import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import { EmptyState, Feedback, LoadingState } from "../components/Feedback.jsx";
import { PageHeader } from "../components/PageHeader.jsx";

export function MissingPage() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const loadItems = useCallback(async () => {
    const result = await api.get("/clothes");
    setItems(result.items.filter((item) => item.status === "missing"));
  }, []);
  useEffect(() => {
    loadItems().catch((requestError) => setError(requestError.message)).finally(() => setLoading(false));
  }, [loadItems]);

  async function markFound(id) {
    setError("");
    try {
      await api.post(`/clothes/${id}/found`, {});
      await loadItems();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return <>
    <PageHeader eyebrow="KEEP AN EYE OUT" title="Missing pieces" description="A gentle reminder of anything you are still looking for." />
    <Feedback error={error} />
    {loading ? <LoadingState label="Looking through your list…" /> : items.length ? <div className="missing-grid">{items.map((item) => <article className="missing-card" key={item._id}><span className="missing-mark">⌕</span><div><p className="clothing-category">{item.category}</p><h2>{item.name}</h2><small>Marked missing {item.lostAt ? new Date(item.lostAt).toLocaleDateString() : "recently"}</small></div><button className="button button-outline" onClick={() => markFound(item._id)}>I found it <span>✓</span></button></article>)}</div> : <div className="panel"><EmptyState icon="✓" title="Everything accounted for" description="No missing items right now. That's a good feeling." /></div>}
  </>;
}
