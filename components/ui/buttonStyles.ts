// The buttons the planner and dialogs share. The main and outline ones are the look's own buttons (.btn-primary, .btn), so they follow
// the chosen look; soft is a pill in the accent tint; a quiet round icon button for row actions.
const base = 'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-solid)] disabled:cursor-not-allowed disabled:opacity-50'
export const BTN_SOLID = 'btn-primary'
export const BTN_SOFT = `${base} min-h-10 rounded-full pointer-coarse:min-h-11 bg-accent-soft px-4 text-accent hover:brightness-95`
export const BTN_OUTLINE = 'btn'
export const BTN_ICON = 'inline-flex size-8 pointer-coarse:size-10 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-surface hover:text-fg disabled:cursor-not-allowed disabled:opacity-40'
