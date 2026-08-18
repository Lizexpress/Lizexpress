export const PageHeader = ({ title, description, action }) => (
  <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
    <div>
      <h1 className="text-heading">{title}</h1>
      {description && <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{description}</p>}
    </div>
    {action}
  </header>
);

export default PageHeader;
