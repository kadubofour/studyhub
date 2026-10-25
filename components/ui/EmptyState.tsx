import type { LucideIcon } from 'lucide-react'

// An invitation for a page with nothing on it yet, the same on every page: a small icon in a quiet square, a headline,
// one sentence, the actions. `level` 1 when it is all the page has (its heading is then the page's).
// `tone` is kept so older callers still type-check; every empty state now looks alike.
export function EmptyState({ icon: Icon, title, body, children, level = 2 }: {
  icon: LucideIcon; tone: 'a' | 'b' | 'c'; title: string; body: string; children?: React.ReactNode; level?: 1 | 2
}) {
  const Heading = level === 1 ? 'h1' : 'h2'
  return (
    <section className="card flex flex-col items-center gap-2 py-10 text-center">
      <span data-art aria-hidden="true" className="mb-1 grid size-12 place-items-center rounded-2xl bg-surface text-muted"><Icon size={22} /></span>
      <Heading className="text-base font-semibold">{title}</Heading>
      <p className="max-w-sm text-sm text-muted">{body}</p>
      {children && <div className="mt-2 flex flex-wrap justify-center gap-2">{children}</div>}
    </section>
  )
}
