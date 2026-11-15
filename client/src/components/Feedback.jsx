export function Feedback({ error, onDismiss }) {
  if (!error) return null;
  return <div className="notice notice-error" role="alert"><span>{error}</span>{onDismiss && <button onClick={onDismiss} aria-label="Dismiss message">×</button>}</div>;
}

export function LoadingState({ label = "Loading…" }) {
  return <div className="loading-state"><span className="spinner" aria-hidden="true" />{label}</div>;
}

export function EmptyState({ icon = "○", title, description, action }) {
  return <div className="empty-state"><span className="empty-icon" aria-hidden="true">{icon}</span><h3>{title}</h3><p>{description}</p>{action}</div>;
}
