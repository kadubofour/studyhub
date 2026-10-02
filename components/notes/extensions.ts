import { Extension, InputRule } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { TaskList, TaskItem } from '@tiptap/extension-list'
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

export function noteExtensions() {
  return [
    StarterKit.configure({ link: false }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Mathematics.configure({ katexOptions: { throwOnError: false } }),
    SingleDollarMath,
    Markdown,
  ]
}
