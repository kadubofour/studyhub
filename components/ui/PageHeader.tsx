export function PageHeader({ title, actions }: { title: string; actions?: React.ReactNode }) {
  // `actions` is where the Phase 2 "Scan" button will go.
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <h1 className="page-title text-lg font-medium">{title}</h1>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
