// Keyboard behaviour for an ARIA radio group: arrows move to the previous/next option and choose it
// (wrapping), Home/End jump to the ends. Returns the index to select, or null for other keys.
export function radioKeyTarget(key: string, index: number, count: number): number | null {
  switch (key) {
    case 'ArrowRight': case 'ArrowDown': return (index + 1) % count
    case 'ArrowLeft': case 'ArrowUp': return (index - 1 + count) % count
    case 'Home': return 0
    case 'End': return count - 1
    default: return null
  }
}

// Focus the radio at `index` inside the group element that contains `from`
export function focusRadio(from: HTMLElement, index: number) {
  const radios = from.closest('[role="radiogroup"]')?.querySelectorAll<HTMLElement>('[role="radio"]')
  radios?.[index]?.focus()
}
