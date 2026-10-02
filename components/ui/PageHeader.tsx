export function PageHeader({ title, actions }: { title: string; actions?: React.ReactNode }) {
  // `actions` is where the Phase 2 "Scan" button will go.
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h1 className="text-lg font-medium">{title}</h1>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
