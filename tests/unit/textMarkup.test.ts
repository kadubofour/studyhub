// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { Editor } from '@tiptap/core'
import { noteExtensions } from '@/components/notes/extensions'
import { stripMarkupForAi } from '@/lib/notes/markup'

const editors: Editor[] = []
const make = (md: string) => { const e = new Editor({ extensions: noteExtensions(), content: md, contentType: 'markdown' }); editors.push(e); return e }
afterEach(() => { while (editors.length) editors.pop()!.destroy() })

const selectWord = (e: Editor, word: string) => {
  let from = -1
  e.state.doc.descendants((n, pos) => { if (from < 0 && n.isText && n.text!.includes(word)) from = pos + n.text!.indexOf(word) })
  e.commands.setTextSelection({ from, to: from + word.length })
}

describe('marking up the words of a note', () => {
  it('highlights the selection in a colour and writes it into the Markdown', () => {
    const e = make('The Krebs cycle runs in the matrix')
    selectWord(e, 'Krebs')
    e.commands.toggleHighlight('green')
    expect(e.getMarkdown()).toBe('The <mark class="hl hl-green">Krebs</mark> cycle runs in the matrix')
  })
  it('reads the highlight back in when the note is opened again', () => {
    const md = 'A <mark class="hl hl-pink">pink</mark> word and a <mark class="hl hl-blue">blue</mark> one'
    const e = make(md)
    expect(e.getMarkdown()).toBe(md)
    expect(e.getHTML()).toContain('class="hl hl-pink"')
  })
  it('the same colour again takes it off, another colour changes it', () => {
    const e = make('one two three')
    selectWord(e, 'two')
    e.commands.toggleHighlight('yellow')
    e.commands.toggleHighlight('orange')
    expect(e.getMarkdown()).toBe('one <mark class="hl hl-orange">two</mark> three')
    e.commands.toggleHighlight('orange')
    expect(e.getMarkdown()).toBe('one two three')
  })
  it('underlines and strikes through, and combines with bold and highlight', () => {
    const e = make('one two three')
    selectWord(e, 'two')
    e.commands.toggleUnderline()
    expect(e.getMarkdown()).toBe('one <u>two</u> three')
    e.commands.toggleBold()
    e.commands.toggleHighlight('blue')
    const md = e.getMarkdown()
    const again = make(md)
    expect(again.getMarkdown()).toBe(md)
    expect(md).toContain('two')
  })
  it('highlights with the keyboard shortcut', () => {
    const e = make('one two')
    selectWord(e, 'two')
    e.commands.keyboardShortcut('Mod-Shift-h')
    expect(e.getMarkdown()).toContain('<mark class="hl hl-yellow">two</mark>')
  })
  it('keeps text it does not understand as text, not as a mark', () => {
    const e = make('<mark class="hl hl-nonsense">x</mark> <script>alert(1)</script>')
    expect(e.getHTML()).not.toContain('<script')
  })
})

describe('markup for the AI', () => {
  it('drops the tags and keeps the words', () => {
    expect(stripMarkupForAi('A <mark class="hl hl-green">key</mark> and <u>important</u> idea')).toBe('A key and important idea')
  })
})
