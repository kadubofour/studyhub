// Keyboard shortcuts that go somewhere: press G, then a letter ("G then P" is the Planner), as in Gmail and GitHub.
// Pure, so it can be tested: the shell feeds each key press through `nextKey`.

export const GO_SHORTCUTS: { key: string; href: string; label: string }[] = [
  { key: 'h', href: '/home', label: 'Home' },
  { key: 'p', href: '/planner', label: 'Planner' },
  { key: 'l', href: '/library', label: 'Library' },
  { key: 'f', href: '/flashcards', label: 'Practice (flashcards)' },
  { key: 'q', href: '/quiz', label: 'Quizzes' },
  { key: 'r', href: '/review', label: 'Review cards' },
  { key: 't', href: '/tutor', label: 'Tutor' },
  { key: 'c', href: '/courses', label: 'Courses' },
  { key: 'o', href: '/focus', label: 'Focus' },
  { key: 'g', href: '/progress', label: 'Progress' },
  { key: 's', href: '/settings', label: 'Settings' },
]
export const GO_WINDOW_MS = 1200

export type KeyState = { armedAt: number | null }
export type KeyResult = { state: KeyState; go?: string; help?: boolean }

/** A key press where the student is not typing, no modifier held. Returns what to do and the new state. */
export function nextKey(state: KeyState, key: string, at: number): KeyResult {
  const k = key.length === 1 ? key.toLowerCase() : key
  if (k === '?') return { state: { armedAt: null }, help: true }
  if (state.armedAt !== null && at - state.armedAt <= GO_WINDOW_MS) {
    const hit = GO_SHORTCUTS.find(s => s.key === k)
    if (hit) return { state: { armedAt: null }, go: hit.href }
    // G pressed again right away starts the wait over (G then G is Progress, so that one is a hit above)
    return { state: { armedAt: null } }
  }
  return { state: { armedAt: k === 'g' ? at : null } }
}

/** Whether a key press comes from somewhere the student is typing, where letters are for the text */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || !el.tagName) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || !!el.closest?.('[contenteditable="true"], dialog[open]')
}
