export function PageHeader({ eyebrow, title, description, action }) {
  return (
    <div className="page-heading">
      <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{description && <p className="page-description">{description}</p>}</div>
      {action && <div className="heading-action">{action}</div>}
    </div>
  );
}
