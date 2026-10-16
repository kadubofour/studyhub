export type FocusShortcut = 'toggle' | 'restart' | 'skip' | 'fullscreen'

// A shortcut must not fight a control that already uses the key: text boxes take every key, buttons and switches take Space
const TYPING = new Set(['INPUT', 'TEXTAREA', 'SELECT'])
const TYPING_ROLES = new Set(['textbox', 'combobox', 'slider', 'listbox'])
const PRESSABLE = new Set(['BUTTON', 'A'])
const PRESSABLE_ROLES = new Set(['switch', 'radio', 'tab', 'option', 'button', 'checkbox'])

/** What a key press means on the Focus page, or null when it is not for the timer */
export function focusShortcut(e: KeyboardEvent): FocusShortcut | null {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return null
  const t = e.target as HTMLElement | null
  const role = t?.getAttribute?.('role') ?? ''
  // A dialog or an open list on top of the page owns the keys (the timer's own full screen view is the exception)
  const layer = t?.closest?.('dialog, [role="dialog"], [role="listbox"]')
  if (layer && layer.getAttribute('aria-label') !== 'Full screen timer') return null
  if (typeof document !== 'undefined' && document.querySelector('dialog[open]')) return null
  if (t && (TYPING.has(t.tagName) || t.isContentEditable || TYPING_ROLES.has(role))) return null
  if (e.key === ' ' && t && (PRESSABLE.has(t.tagName) || PRESSABLE_ROLES.has(role))) return null
  switch (e.key.toLowerCase()) {
    case ' ': return 'toggle'
    case 'r': return 'restart'
    case 's': return 'skip'
    case 'f': return 'fullscreen'
    default: return null
  }
}
