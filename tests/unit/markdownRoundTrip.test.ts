// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import { noteExtensions } from '@/components/notes/extensions'

function roundTrip(md: string): string {
  const editor = new Editor({ extensions: noteExtensions(), content: md, contentType: 'markdown' })
  const out = editor.getMarkdown()
  editor.destroy()
  return out.trim()
}

describe('typing in rich mode', () => {
  it('turns $...$ into rendered inline math, matching the Markdown syntax', () => {
    const editor = new Editor({ extensions: noteExtensions(), content: '' })
    const v = editor.view
    for (const ch of 'Area $x^2$') {
      const { from, to } = v.state.selection
      const handled = v.someProp('handleTextInput', f => f(v, from, to, ch, () => v.state.tr.insertText(ch, from, to)))
      if (!handled) v.dispatch(v.state.tr.insertText(ch, from, to))
    }
    const types: string[] = []
    editor.state.doc.descendants(n => { types.push(n.type.name) })
    expect(types).toContain('inlineMath')
    expect(editor.getMarkdown().trim()).toBe('Area $x^2$')
    editor.destroy()
  })
  it('leaves a lone dollar amount alone', () => {
    const editor = new Editor({ extensions: noteExtensions(), content: '' })
    const v = editor.view
    for (const ch of 'costs $5 today') {
      const { from, to } = v.state.selection
      const handled = v.someProp('handleTextInput', f => f(v, from, to, ch, () => v.state.tr.insertText(ch, from, to)))
      if (!handled) v.dispatch(v.state.tr.insertText(ch, from, to))
    }
    const types: string[] = []
    editor.state.doc.descendants(n => { types.push(n.type.name) })
    expect(types).not.toContain('inlineMath')
    editor.destroy()
  })
})

describe('notes markdown round-trip', () => {
  it.each([
    '# Heading\n\nSome **bold** and *italic* text.',
    '- one\n- two',
    '1. first\n2. second',
    '- [ ] todo\n- [x] done',
    '```\ncode block\n```',
    'Inline math $x^2 + 1$ here.',
    '$$\n\\frac{a}{b}\n$$',
  ])('preserves %j', md => {
    expect(roundTrip(md)).toBe(md)
  })
})
