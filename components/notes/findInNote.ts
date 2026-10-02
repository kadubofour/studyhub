import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'

export type Match = { from: number; to: number }

/** Every case-insensitive match of `query` in the document's text, as document positions. */
export function findMatches(doc: PMNode, query: string): Match[] {
  const q = query.toLowerCase()
  if (!q) return []
  const out: Match[] = []
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true
    // Join the block's text, remembering where each character sits, so a match
    // can span bold/italic boundaries but never an inline equation.
    let text = ''
    const at: number[] = []
    node.forEach((child, offset) => {
      if (child.isText) {
        for (let i = 0; i < child.text!.length; i++) at.push(pos + 1 + offset + i)
        text += child.text
      } else { text += '\u0000'; at.push(-1) }
    })
    const lower = text.toLowerCase()
    for (let i = lower.indexOf(q); i !== -1; i = lower.indexOf(q, i + q.length)) {
      out.push({ from: at[i], to: at[i + q.length - 1] + 1 })
    }
    return false
  })
  return out
}

/** Index `i` wrapped into 0..n-1 (so Previous on the first match goes to the last). */
export const wrap = (i: number, n: number) => (n ? ((i % n) + n) % n : 0)

// Added at runtime: the build's CSS minifier doesn't know ::highlight() yet and warns about it
function ensureHighlightStyles() {
  if (document.getElementById('find-highlight-styles')) return
  const style = document.createElement('style')
  style.id = 'find-highlight-styles'
  style.textContent = '::highlight(find-hit){background-color:color-mix(in oklab,#facc15 45%,transparent)}'
    + '::highlight(find-current){background-color:#facc15;color:#000}'
  document.head.append(style)
}

/**
 * Find in rendered (read-only) text: highlights every match with the CSS Custom Highlight API
 * where the browser has it, scrolls to match `index`, and returns the number of matches.
 */
export function highlightInElement(el: HTMLElement | null, query: string, index: number): number {
  const reg = typeof CSS !== 'undefined' && 'highlights' in CSS ? CSS.highlights : null
  reg?.delete('find-hit'); reg?.delete('find-current')
  const q = query.toLowerCase()
  if (!el || !q) return 0
  const ranges: Range[] = []
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    // KaTeX output repeats an equation's text in hidden markup; don't count it
    acceptNode: n => (n.parentElement?.closest('.katex') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  })
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent!.toLowerCase()
    for (let i = t.indexOf(q); i !== -1; i = t.indexOf(q, i + q.length)) {
      const r = document.createRange()
      r.setStart(n, i); r.setEnd(n, i + q.length)
      ranges.push(r)
    }
  }
  if (!ranges.length) return 0
  const k = wrap(index, ranges.length)
  if (reg) { ensureHighlightStyles(); reg.set('find-hit', new Highlight(...ranges)); reg.set('find-current', new Highlight(ranges[k])) }
  ranges[k].startContainer.parentElement?.scrollIntoView({ block: 'center' })
  return ranges.length
}

/** Clears highlights left by highlightInElement. */
export function clearElementHighlights() {
  if (typeof CSS !== 'undefined' && 'highlights' in CSS) { CSS.highlights.delete('find-hit'); CSS.highlights.delete('find-current') }
}

type FindState ={ query: string; index: number; decorations: DecorationSet }
export const findKey = new PluginKey<FindState>('findInNote')

/** Highlights find matches; set them with tr.setMeta(findKey, { query, index }). */
export const FindHighlight = Extension.create({
  name: 'findHighlight',
  addProseMirrorPlugins() {
    const build = (doc: PMNode, query: string, index: number) => DecorationSet.create(doc,
      findMatches(doc, query).map((m, i) => Decoration.inline(m.from, m.to, { class: i === index ? 'find-hit find-current' : 'find-hit' })))
    return [new Plugin<FindState>({
      key: findKey,
      state: {
        init: () => ({ query: '', index: 0, decorations: DecorationSet.empty }),
        apply(tr, prev) {
          const meta = tr.getMeta(findKey) as { query: string; index: number } | undefined
          if (meta) return { ...meta, decorations: build(tr.doc, meta.query, meta.index) }
          if (tr.docChanged && prev.query) return { ...prev, decorations: build(tr.doc, prev.query, prev.index) }
          return prev
        },
      },
      props: { decorations: state => findKey.getState(state)?.decorations },
    })]
  },
})
