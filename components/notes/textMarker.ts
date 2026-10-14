import type { Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { HighlightName } from '@/lib/notes/markup'

/** What the marker does to the words it is dragged over */
export type MarkerTool = 'highlight' | 'underline' | 'strike' | 'erase'

const WORD = /[\p{L}\p{N}_'’-]/u

/** The word around a position, for a click with no drag; null when the position is not in a word */
export function wordRange(doc: PMNode, pos: number): { from: number; to: number } | null {
  const $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)))
  const parent = $pos.parent
  if (!parent.isTextblock) return null
  const text = parent.textBetween(0, parent.content.size, undefined, '￼')
  let i = $pos.parentOffset
  if (i < text.length && !WORD.test(text[i]) && i > 0 && WORD.test(text[i - 1])) i -= 1 // just after a word counts as in it
  if (i >= text.length || !WORD.test(text[i])) return null
  let a = i, b = i + 1
  while (a > 0 && WORD.test(text[a - 1])) a--
  while (b < text.length && WORD.test(text[b])) b++
  const start = $pos.start()
  return { from: start + a, to: start + b }
}

/** Puts the marker's mark on the text between two positions, or takes the marks off for the eraser. The cursor ends after the marked text. */
export function applyMarker(editor: Editor, tool: MarkerTool, color: HighlightName, from: number, to: number) {
  if (to <= from) return false
  const chain = editor.chain().setTextSelection({ from, to })
  if (tool === 'highlight') chain.setMark('highlight', { color })
  else if (tool === 'underline') chain.setMark('underline')
  else if (tool === 'strike') chain.setMark('strike')
  else chain.unsetMark('highlight').unsetMark('underline').unsetMark('strike')
  return chain.setTextSelection(to).run()
}
