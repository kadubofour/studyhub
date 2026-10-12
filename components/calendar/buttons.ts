// The calendar's own buttons: squarer than the app's pills, so the toolbar reads as one tidy bar
const base = 'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-60'
export const CAL_BTN = `${base} border border-line bg-raised hover:bg-surface`
export const CAL_BTN_SOFT = `${base} bg-accent-soft text-accent hover:brightness-95`
export const CAL_BTN_PRIMARY = `${base} bg-accent-solid text-white hover:brightness-110`
