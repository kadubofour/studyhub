// The pages a student has moved through in this tab, so a back button can lead to the page before and not always to a fixed one.
// Moving to the page just under the top is going back (the browser's Back or a back button), so the top is dropped; anything else is a step forward.

const MAX = 50
const KEY = 'studyhub:pages'

/** The stack after arriving at `path` */
export function visit(stack: string[], path: string): string[] {
  if (stack.at(-1) === path) return stack
  if (stack.length > 1 && stack.at(-2) === path) return stack.slice(0, -1)
  return [...stack, path].slice(-MAX)
}

/** Whether there is a page in the app before this one */
export const canGoBack = (stack: string[]) => stack.length > 1

export function readStack(): string[] {
  try { const v = JSON.parse(sessionStorage.getItem(KEY) ?? '[]'); return Array.isArray(v) ? v.filter((p): p is string => typeof p === 'string') : [] } catch { return [] }
}
export function writeStack(stack: string[]) { try { sessionStorage.setItem(KEY, JSON.stringify(stack)) } catch { /* private mode: the back button then uses its fixed page */ } }
