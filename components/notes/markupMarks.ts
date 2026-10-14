import { Mark, mergeAttributes } from '@tiptap/core'
import Underline from '@tiptap/extension-underline'
import { CLOSE_MARK, CLOSE_UNDERLINE, OPEN_UNDERLINE, isHighlight, openMark, type HighlightName } from '@/lib/notes/markup'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    highlight: {
      /** Highlights the selection in a colour; the same colour again takes it off, another colour changes it */
      toggleHighlight: (color: HighlightName) => ReturnType
    }
  }
}

// A highlighter pen for the words of a note. Stored in Markdown as <mark class="hl hl-green">…</mark>.
export const Highlight = Mark.create({
  name: 'highlight',
  addAttributes() {
    return {
      color: {
        default: 'yellow',
        parseHTML: el => {
          const c = /\bhl-([a-z]+)\b/.exec(el.getAttribute('class') ?? '')?.[1]
          return isHighlight(c) ? c : 'yellow'
        },
      },
    }
  },
  parseHTML() { return [{ tag: 'mark' }] },
  renderHTML({ mark }) {
    return ['mark', mergeAttributes({ class: `hl hl-${isHighlight(mark.attrs.color) ? mark.attrs.color : 'yellow'}` }, { 'data-markup': 'highlight' }), 0]
  },
  renderMarkdown: (node, h) => {
    const color = isHighlight(node.attrs?.color) ? node.attrs.color : 'yellow'
    return `${openMark(color)}${h.renderChildren(node)}${CLOSE_MARK}`
  },
  addCommands() {
    return {
      toggleHighlight: color => ({ editor, commands }) =>
        editor.isActive('highlight', { color }) ? commands.unsetMark('highlight') : commands.setMark('highlight', { color }),
    }
  },
  addKeyboardShortcuts() { return { 'Mod-Shift-h': () => this.editor.commands.toggleHighlight('yellow') } },
})

// Underline, written as <u>…</u> so the reading view and exports can draw it
export const NoteUnderline = Underline.extend({
  renderMarkdown: (node, h) => `${OPEN_UNDERLINE}${h.renderChildren(node)}${CLOSE_UNDERLINE}`,
})
