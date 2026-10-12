import type { LucideIcon } from 'lucide-react'

// An invitation for a page with nothing on it yet: a small picture in the page's colour, a headline, one sentence, the actions.
// `tone` picks one of the three tile colours (Vivid and Paper tint them; Classic keeps them plain).
export function EmptyState({ icon: Icon, tone, title, body, children }: {
  icon: LucideIcon; tone: 'a' | 'b' | 'c'; title: string; body: string; children?: React.ReactNode
}) {
  return (
    <section className="card flex flex-col items-center gap-3 py-10 text-center">
      <div data-art aria-hidden="true" className="relative mb-1 flex size-24 items-center justify-center">
        <span className={`tile-${tone} absolute inset-0 rotate-6 rounded-[2rem] border border-line`} />
        <span className="absolute inset-2 -rotate-6 rounded-[1.75rem] bg-accent-soft" />
        <Icon size={40} strokeWidth={1.75} className="relative text-accent" />
        <svg className="absolute -right-2 -top-2 text-accent" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.2 6.8L21 11l-6.8 2.2L12 20l-2.2-6.8L3 11l6.8-2.2z" /></svg>
        <svg className="absolute -bottom-1 -left-3 text-muted" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.2 6.8L21 11l-6.8 2.2L12 20l-2.2-6.8L3 11l6.8-2.2z" /></svg>
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-sm text-sm text-muted">{body}</p>
      {children && <div className="mt-1 flex flex-wrap justify-center gap-2">{children}</div>}
    </section>
  )
}
