// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import { noteExtensions } from '@/components/notes/extensions'
import { mathToken, autoWrapMath } from '@/components/notes/autoMath'

describe('mathToken: which typed words are maths', () => {
  it.each([
    ['x^2', 'x^2', ''],
    ['x^2,', 'x^2', ','],
    ['e^{i\\pi}.', 'e^{i\\pi}', '.'],
    ['a_n', 'a_n', ''],
    ['H_2O', 'H_2O', ''],
    ['x_1+x_2=y', 'x_1+x_2=y', ''],
    ['\\frac{a}{b}', '\\frac{a}{b}', ''],
    ['\\alpha', '\\alpha', ''],
    ['(x+1)^2', '(x+1)^2', ''],
  ])('%s is maths', (word, latex, trailing) => {
    expect(mathToken(word)).toEqual({ latex, trailing })
  })

  it.each([
    'hello', 'my_variable', 'snake_case_name', '^_^', 'C:\\Users', '\\notacommand', 'x^', 'x^{2',
    'https://a.com/x^2', 'me@x_y.com', '$x^2$', '`x^2`', '2^', 'file_v2', '__init__',
  ])('%s is not maths', word => {
    expect(mathToken(word)).toBeNull()
  })
})

function typeInto(editor: Editor, text: string) {
  const v = editor.view
  for (const ch of text) {
    const { from, to } = v.state.selection
    const handled = v.someProp('handleTextInput', f => f(v, from, to, ch, () => v.state.tr.insertText(ch, from, to)))
    if (!handled) v.dispatch(v.state.tr.insertText(ch, from, to))
  }
}
const types = (editor: Editor) => { const t: string[] = []; editor.state.doc.descendants(n => { t.push(n.type.name) }); return t }

describe('rich editor turns typed maths into equations', () => {
  it('converts x^2 when you type a space, keeping punctuation as text', () => {
    const editor = new Editor({ extensions: noteExtensions() })
    typeInto(editor, 'Area x^2, done')
    expect(types(editor)).toContain('inlineMath')
    expect(editor.getMarkdown().trim()).toBe('Area $x^2$, done')
    editor.destroy()
  })
  it('converts LaTeX commands', () => {
    const editor = new Editor({ extensions: noteExtensions() })
    typeInto(editor, 'so \\frac{1}{2} ')
    expect(editor.getMarkdown().trim()).toBe('so $\\frac{1}{2}$')
    editor.destroy()
  })
  it('leaves ordinary words and code alone', () => {
    const editor = new Editor({ extensions: noteExtensions() })
    typeInto(editor, 'my_variable is set ')
    expect(types(editor)).not.toContain('inlineMath')
    editor.commands.setContent('```\n\n```', { contentType: 'markdown' })
    editor.commands.setTextSelection(1)
    typeInto(editor, 'x^2 ')
    expect(types(editor)).not.toContain('inlineMath')
    editor.destroy()
  })
  it('Backspace right after turns it back into text', () => {
    const editor = new Editor({ extensions: noteExtensions() })
    typeInto(editor, 'x^2 ')
    expect(types(editor)).toContain('inlineMath')
    editor.commands.undoInputRule()
    expect(types(editor)).not.toContain('inlineMath')
    expect(editor.getText()).toBe('x^2 ')
    editor.destroy()
  })
})

describe('autoWrapMath: the Markdown editor wraps typed maths in $…$', () => {
  const typed = (before: string, after = '') => autoWrapMath(before + after, before.length)
  it('wraps the word before the space just typed', () => {
    expect(typed('Area x^2 ')).toEqual({ value: 'Area $x^2$ ', cursor: 11 })
    expect(typed('so a_n, ', 'rest')).toEqual({ value: 'so $a_n$, rest', cursor: 10 })
  })
  it('does nothing for plain words, inside $…$, code spans or code blocks', () => {
    expect(typed('hello ')).toBeNull()
    expect(typed('$y = x^2 ')).toBeNull()
    expect(typed('`x^2 ')).toBeNull()
    expect(typed('```\nx^2 ')).toBeNull()
    expect(typed('$$\nx^2 ')).toBeNull()
  })
  it('only reacts to a space', () => {
    expect(autoWrapMath('x^2', 3)).toBeNull()
  })
})
