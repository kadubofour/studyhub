// One set of buttons for the planner: solid for the main action, soft for the rest, an outline for neutral ones, a quiet round icon button for row actions.
// Plain rounded rectangles, one height, no pill outlines.
const base = 'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-solid)] disabled:cursor-not-allowed disabled:opacity-50'
export const BTN_SOLID = `${base} h-9 bg-accent-solid px-4 text-white hover:brightness-110`
export const BTN_SOFT = `${base} h-9 bg-accent-soft px-3.5 text-accent hover:brightness-95`
export const BTN_OUTLINE = `${base} h-9 border border-line bg-raised px-3.5 hover:bg-surface`
export const BTN_ICON = 'inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-surface hover:text-fg disabled:cursor-not-allowed disabled:opacity-40'
