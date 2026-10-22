// The command palette's list: things to do, places to go, courses and recent material, narrowed by what is typed.

export type PaletteGroup = 'Do' | 'Go to' | 'Courses' | 'Recent'
export interface PaletteItem {
  id: string; group: PaletteGroup; label: string
  /** A short word at the right: "Note", "Deck" */
  hint?: string
  /** Other words it can be found by */
  keywords?: string
  run: { href: string } | { action: string }
}

const GROUP_ORDER: PaletteGroup[] = ['Do', 'Go to', 'Courses', 'Recent']
const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Every word typed must be found in the label or its keywords. Within a group, labels that start with the first word come first. */
export function filterPalette(items: PaletteItem[], query: string): PaletteItem[] {
  const words = plain(query).split(/\s+/).filter(Boolean)
  const byGroup = (a: PaletteItem, b: PaletteItem) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group)
  if (!words.length) return [...items].sort(byGroup)
  const scored = items.flatMap((item, i) => {
    const label = plain(item.label)
    const all = `${label} ${plain(item.keywords ?? '')}`
    if (!words.every(w => all.includes(w))) return []
    const rank = label.startsWith(words[0]) ? 0 : label.split(/\s+/).some(w => w.startsWith(words[0])) ? 1 : 2
    return [{ item, rank, i }]
  })
  // the best matches first, whatever their group; ties keep the usual order of groups and items
  return scored.sort((a, b) => a.rank - b.rank || byGroup(a.item, b.item) || a.i - b.i).map(s => s.item)
}
