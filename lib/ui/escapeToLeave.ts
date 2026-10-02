// Should Esc leave the full-screen editor? Not while an IME is composing (Esc there cancels the
// candidate text), not when a menu already used it, and not with a dialog open.
// `fromEditor`: the key came from the rich text editor. ProseMirror marks every Esc as handled
// (preventDefault) without doing anything with it, so there it doesn't mean a menu used it.
export function shouldLeaveOnEscape(
  e: { key: string; isComposing: boolean; defaultPrevented: boolean; keyCode: number },
  dialogOpen: boolean,
  fromEditor = false,
): boolean {
  if (e.key !== 'Escape' || (e.defaultPrevented && !fromEditor) || dialogOpen) return false
  return !(e.isComposing || e.keyCode === 229)
}
