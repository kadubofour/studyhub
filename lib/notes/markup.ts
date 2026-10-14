// Marking up the words of a note: highlights in colours and underline, stored as a few inline tags in the Markdown

export const HIGHLIGHTS = [
  { name: 'yellow', label: 'Yellow', swatch: '#fde047' },
  { name: 'green', label: 'Green', swatch: '#86efac' },
  { name: 'blue', label: 'Blue', swatch: '#93c5fd' },
  { name: 'pink', label: 'Pink', swatch: '#f9a8d4' },
  { name: 'orange', label: 'Orange', swatch: '#fdba74' },
  { name: 'purple', label: 'Purple', swatch: '#d8b4fe' },
] as const
export type HighlightName = (typeof HIGHLIGHTS)[number]['name']
export const isHighlight = (v: unknown): v is HighlightName => HIGHLIGHTS.some(h => h.name === v)

export const openMark = (color: HighlightName) => `<mark class="hl hl-${color}">`
export const CLOSE_MARK = '</mark>'
export const OPEN_UNDERLINE = '<u>'
export const CLOSE_UNDERLINE = '</u>'

type Node = { type: string; value?: string; children?: Node[]; [k: string]: unknown }

const OPEN = /^<mark class="hl hl-([a-z]+)">$/

function openOf(n: Node): { kind: 'highlight' | 'underline'; color?: HighlightName; close: string } | null {
  if (n.type !== 'html' || typeof n.value !== 'string') return null
  const v = n.value.trim()
  const m = OPEN.exec(v)
  if (m && isHighlight(m[1])) return { kind: 'highlight', color: m[1], close: CLOSE_MARK }
  if (v === OPEN_UNDERLINE) return { kind: 'underline', close: CLOSE_UNDERLINE }
  return null
}

function wrap(children: Node[]): Node[] {
  const out: Node[] = []
  for (let i = 0; i < children.length; i++) {
    const n = children[i]
    const open = openOf(n)
    if (open) {
      const j = children.findIndex((c, k) => k > i && c.type === 'html' && c.value?.trim() === open.close)
      if (j > i) {
        const inner = wrap(children.slice(i + 1, j))
        out.push(open.kind === 'highlight'
          ? { type: 'noteMark', kind: 'highlight', color: open.color, children: inner, data: { hName: 'mark', hProperties: { className: ['hl', `hl-${open.color}`] } } }
          : { type: 'noteMark', kind: 'underline', children: inner, data: { hName: 'u' } })
        i = j
        continue
      }
    }
    out.push(n.children ? { ...n, children: wrap(n.children) } : n)
  }
  return out
}

/**
 * remark plugin: turns the note's highlight and underline tags into marks around their text. Only these exact tags are
 * recognised; any other raw HTML is left as it is (and is not drawn), so notes cannot smuggle markup in.
 */
export function remarkMarkup() {
  return (tree: Node) => { if (tree.children) tree.children = wrap(tree.children) }
}

/** The note with the markup tags taken out and the words kept: what is sent to the AI */
export function stripMarkupForAi(md: string): string {
  return md.replace(/<mark class="hl hl-[a-z]+">|<\/mark>|<u>|<\/u>/g, '')
}
