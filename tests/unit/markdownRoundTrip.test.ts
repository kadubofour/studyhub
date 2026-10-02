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
  it('turns $$...$$ into a displayed equation on its own line', () => {
    const editor = new Editor({ extensions: noteExtensions(), content: '' })
    const v = editor.view
    for (const ch of '$$\\frac{a}{b}$$') {
      const { from, to } = v.state.selection
      const handled = v.someProp('handleTextInput', f => f(v, from, to, ch, () => v.state.tr.insertText(ch, from, to)))
      if (!handled) v.dispatch(v.state.tr.insertText(ch, from, to))
    }
    const types: string[] = []
    editor.state.doc.descendants(n => { types.push(n.type.name) })
    expect(types).toContain('blockMath')
    expect(editor.getMarkdown().trim()).toBe('$$\n\\frac{a}{b}\n$$')
    editor.destroy()
  })
  it('lets the note open an equation for editing when it is clicked', () => {
    const onEditMath = () => {}
    const exts = noteExtensions({ onEditMath })
    const math = exts.find(e => e.name === 'Mathematics') as { options: { inlineOptions?: { onClick?: unknown }; blockOptions?: { onClick?: unknown } } }
    expect(typeof math.options.inlineOptions?.onClick).toBe('function')
    expect(typeof math.options.blockOptions?.onClick).toBe('function')
  })
  it('leaves a price range like $5-$10 alone', () => {
    const editor = new Editor({ extensions: noteExtensions(), content: '' })
    const v = editor.view
    for (const ch of 'tickets $5-$10 each') {
      const { from, to } = v.state.selection
      const handled = v.someProp('handleTextInput', f => f(v, from, to, ch, () => v.state.tr.insertText(ch, from, to)))
      if (!handled) v.dispatch(v.state.tr.insertText(ch, from, to))
    }
    const types: string[] = []
    editor.state.doc.descendants(n => { types.push(n.type.name) })
    expect(types).not.toContain('inlineMath')
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
    // tables: the serializer pads columns to line up; that padded form must round-trip unchanged
    '| Term | Meaning |\n| ---- | ------- |\n| ATP  | energy  |\n| DNA  | genes   |',
    '$$\n\\frac{a}{b}\n$$',
  ])('preserves %j', md => {
    expect(roundTrip(md)).toBe(md)
  })
})
