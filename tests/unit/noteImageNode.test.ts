// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { Editor } from '@tiptap/core'
import { noteExtensions } from '@/components/notes/extensions'
import { insertNoteImage, noteImages } from '@/components/notes/noteImage'

const editors: Editor[] = []
const make = (md: string) => { const e = new Editor({ extensions: noteExtensions(), content: md, contentType: 'markdown' }); editors.push(e); return e }
afterEach(() => { while (editors.length) editors.pop()!.destroy() })

describe('pictures in a note', () => {
  it('load from Markdown and write back the same', () => {
    const md = 'Before\n\n![The Krebs cycle](studyhub-image:a.webp)\n\nAfter'
    const e = make(md)
    expect(noteImages(e)).toEqual([{ pos: expect.any(Number), src: 'studyhub-image:a.webp', alt: 'The Krebs cycle' }])
    expect(e.getMarkdown()).toBe(md)
  })
  it('keep a picture with no description', () => {
    const e = make('![](studyhub-image:b.png)')
    expect(noteImages(e)[0]).toMatchObject({ src: 'studyhub-image:b.png', alt: '' })
    expect(e.getMarkdown()).toContain('studyhub-image:b.png')
  })
  it('sit among the text and keep the text around them', () => {
    const e = make('One\n\n![x](studyhub-image:a.webp)\n\nTwo\n\n![y](studyhub-image:b.webp)')
    expect(noteImages(e).map(i => i.src)).toEqual(['studyhub-image:a.webp', 'studyhub-image:b.webp'])
    expect(e.getText()).toContain('One')
    expect(e.getText()).toContain('Two')
  })
  it('can be put in at the cursor, with their description', () => {
    const e = make('Hello')
    e.commands.focus('end')
    insertNoteImage(e, 'studyhub-image:new.webp', 'A diagram')
    expect(e.getMarkdown()).toContain('![A diagram](studyhub-image:new.webp)')
    expect(e.getMarkdown()).toContain('Hello')
  })
  it('can be put in an empty note', () => {
    const e = make('')
    insertNoteImage(e, 'studyhub-image:new.webp', '')
    expect(noteImages(e)).toHaveLength(1)
  })
  it('can be swapped for another picture in the same place (what Markup does)', () => {
    const e = make('A\n\n![x](studyhub-image:old.webp)\n\nB')
    const { pos } = noteImages(e)[0]
    e.view.dispatch(e.state.tr.setNodeMarkup(pos, undefined, { src: 'studyhub-image:new.webp', alt: 'x' }))
    expect(e.getMarkdown()).toBe('A\n\n![x](studyhub-image:new.webp)\n\nB')
  })
})
