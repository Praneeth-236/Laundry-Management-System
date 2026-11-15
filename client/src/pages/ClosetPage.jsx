import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { EmptyState, Feedback, LoadingState } from "../components/Feedback.jsx";
import { PageHeader } from "../components/PageHeader.jsx";

export function ClosetPage() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ name: "", category: "", photo: null });
  const [newCategory, setNewCategory] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadItems = useCallback(async () => {
    const result = await api.get("/clothes");
    setItems(result.items);
    setCategories(result.categories);
    setForm((current) => ({ ...current, category: current.category || result.categories[0] || "" }));
  }, []);

  useEffect(() => {
    loadItems().catch((requestError) => setError(requestError.message)).finally(() => setLoading(false));
  }, [loadItems]);

  const visibleItems = useMemo(() => items.filter((item) => {
    const matchesName = item.name.toLowerCase().includes(search.trim().toLowerCase());
    const matchesCategory = categoryFilter === "all" || categoryFilter === item.category;
    return item.status !== "missing" && matchesName && matchesCategory;
  }), [items, search, categoryFilter]);

  async function addItem(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusy(true);
    setError("");
    const body = new FormData();
    body.set("name", form.name);
    body.set("category", form.category);
    if (form.photo) body.set("photo", form.photo);
    try {
      await api.post("/clothes", body);
      setForm((current) => ({ ...current, name: "", photo: null }));
      formElement.reset();
      await loadItems();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function addCategory(event) {
    event.preventDefault();
    setError("");
    try {
      const result = await api.post("/clothes/categories", { name: newCategory });
      setCategories(result.categories);
      setForm((current) => ({ ...current, category: newCategory }));
      setNewCategory("");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function changeStatus(item, action) {
    setError("");
    try {
      await api.post(`/clothes/${item._id}/${action}`, {});
      await loadItems();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function archive(item) {
    if (!window.confirm(`Remove ${item.name} from your active closet? Its laundry history will stay saved.`)) return;
    setError("");
    try {
      await api.delete(`/clothes/${item._id}`);
      await loadItems();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return <>
    <PageHeader eyebrow="YOUR PERSONAL INVENTORY" title="My closet" description="Keep the everyday pieces you wear in one easy place." />
    <Feedback error={error} onDismiss={() => setError("")} />
    <section className="panel add-item-panel"><div className="section-title"><div><p className="eyebrow">ADD TO YOUR CLOSET</p><h2>A piece you reach for</h2></div><span className="section-mark">＋</span></div>
      <form className="add-item-form" onSubmit={addItem}>
        <label>Item name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} maxLength="80" placeholder="e.g. Blue everyday shirt" required /></label>
        <label>Category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} required>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
        <label className="photo-input">Photo <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => setForm({ ...form, photo: event.target.files?.[0] ?? null })} /></label>
        <button className="button button-primary" disabled={busy}>{busy ? "Adding…" : "Add piece"}<span>＋</span></button>
      </form>
      <form className="category-form" onSubmit={addCategory}><label htmlFor="new-category">A category of your own</label><input id="new-category" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} maxLength="32" placeholder="e.g. Sportswear" required /><button className="button button-outline">Add category</button></form>
    </section>

    <section className="inventory-section"><div className="inventory-toolbar"><div><p className="eyebrow">THE CLOSET</p><h2>{visibleItems.length} {visibleItems.length === 1 ? "piece" : "pieces"}</h2></div><div className="filter-controls"><label className="search-box"><span aria-hidden="true">⌕</span><input aria-label="Search closet" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a piece" /></label><select aria-label="Filter by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></div></div>
      {loading ? <LoadingState label="Opening your closet…" /> : visibleItems.length === 0 ? <div className="panel"><EmptyState icon="▤" title={items.length ? "No pieces match that search" : "A closet that starts with you"} description={items.length ? "Try another name or category." : "Add the clothes you wear most to begin."} /></div> : <div className="clothing-grid">{visibleItems.map((item, index) => <article className="clothing-card" key={item._id}><div className={`clothing-photo photo-${index % 5}`}>{item.photoKey ? <img src={`/api/clothes/${item._id}/photo`} alt={item.name} /> : <span aria-hidden="true">{item.category === "Towels" ? "▰" : "◒"}</span>}<span className={`status-pill status-${item.status}`}>{item.status === "in_laundry" ? "In the wash" : "Ready"}</span></div><div className="clothing-info"><p className="clothing-category">{item.category}</p><h3>{item.name}</h3><p className="clothing-meta">{item.lastWashedAt ? `Last washed ${new Date(item.lastWashedAt).toLocaleDateString()}` : "Not washed yet"}</p><div className="item-actions">{item.status === "available" && <button className="text-button" onClick={() => changeStatus(item, "missing")}>Mark missing</button>}{item.status !== "in_laundry" && <button className="icon-button" onClick={() => archive(item)} aria-label={`Remove ${item.name}`}>×</button>}</div></div></article>)}</div>}
    </section>
  </>;
}
