// Should Esc leave the full-screen editor? Not while an IME is composing (Esc there cancels the
// candidate text), not when a menu already used it, and not with a dialog open.
export function shouldLeaveOnEscape(
  e: { key: string; isComposing: boolean; defaultPrevented: boolean; keyCode: number },
  dialogOpen: boolean,
): boolean {
  if (e.key !== 'Escape' || e.defaultPrevented || dialogOpen) return false
  return !(e.isComposing || e.keyCode === 229)
}
