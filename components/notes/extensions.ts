import { Extension, InputRule } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { TaskList, TaskItem } from '@tiptap/extension-list'
import { TableKit } from '@tiptap/extension-table'
import { Markdown } from '@tiptap/markdown'
import Mathematics from '@tiptap/extension-mathematics'

// The Mathematics extension's typing shortcut is $$x$$, but notes store inline math as $x$.
// This lets $x$ typed in Rich mode render immediately, matching the Markdown syntax.
// The body must not start or end with a space, and must not end with an operator or
// punctuation, so prices like "$5 and $10" or "$5-$10" stay plain text.
const SingleDollarMath = Extension.create({
  name: 'singleDollarMath',
  addInputRules() {
    return [new InputRule({
      find: /(?:^|[^$\\])\$([^\s$](?:[^$\n]*[^\s$\-+*/=,.;:])?)\$$/,
      handler: ({ state, range, match }) => {
        const node = state.schema.nodes.inlineMath?.create({ latex: match[1] })
        if (!node) return null
        const start = range.from + match[0].indexOf('$')
        state.tr.replaceWith(start, range.to, node)
      },
    })]
  },
})

// "$$…$$" typed as a paragraph of its own becomes a displayed (block) equation, matching how
// notes store display math. Runs before Mathematics' own $$…$$ rule, which would make it inline.
const DoubleDollarBlockMath = Extension.create({
  name: 'doubleDollarBlockMath',
  priority: 200,
  addInputRules() {
    return [new InputRule({
      find: /^\$\$([^$]+)\$\$$/,
      handler: ({ state, range, match }) => {
        const node = state.schema.nodes.blockMath?.create({ latex: match[1].trim() })
        const $from = state.doc.resolve(range.from)
        if (!node || $from.parent.textContent !== match[0]) return null // only a whole paragraph
        state.tr.replaceWith($from.before(), $from.after(), node)
      },
    })]
  },
})

export type EditMath = (kind: 'inline' | 'block', latex: string, pos: number) => void

export function noteExtensions(opts: { onEditMath?: EditMath } = {}) {
  return [
    StarterKit.configure({ link: false }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit.configure({ table: { resizable: false } }),
    DoubleDollarBlockMath,
    Mathematics.configure({
      katexOptions: { throwOnError: false },
      // Clicking a rendered equation opens it for editing
      inlineOptions: { onClick: (node, pos) => opts.onEditMath?.('inline', node.attrs.latex, pos) },
      blockOptions: { onClick: (node, pos) => opts.onEditMath?.('block', node.attrs.latex, pos) },
    }),
    SingleDollarMath,
    Markdown,
  ]
}
