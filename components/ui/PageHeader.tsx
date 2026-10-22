export function PageHeader({ title, actions }: { title: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-x-5 gap-y-4">
      <h1 className="page-title font-display text-[2.125rem] font-semibold leading-[1.1] tracking-tight sm:text-[2.5rem]">{title}</h1>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
