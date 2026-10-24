// A screen's title: app-sized (26-28px), not a landing-page headline
export const PAGE_TITLE = 'page-title font-display text-[1.625rem] font-semibold leading-tight tracking-tight sm:text-[1.75rem]'

// The title, an optional line about the data under it (the period, the count, the one fact), and the screen's actions at the right
export function PageHeader({ title, summary, actions }: { title: string; summary?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-x-5 gap-y-4">
      <div className="min-w-0">
        <h1 className={PAGE_TITLE}>{title}</h1>
        {summary && <p className="mt-1 text-[15px] text-muted">{summary}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
