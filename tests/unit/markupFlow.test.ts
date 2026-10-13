// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { Editor } from '@tiptap/core'
import type { SupabaseClient } from '@supabase/supabase-js'

const upload = vi.fn(async (..._a: unknown[]) => 'studyhub-image:new.webp')
const remove = vi.fn(async (..._a: unknown[]) => {})
vi.mock('@/lib/notes/prepareImage', async orig => ({
  ...(await orig<typeof import('@/lib/notes/prepareImage')>()),
  uploadNoteImage: (...a: unknown[]) => upload(...a),
  removeNoteImages: (...a: unknown[]) => remove(...a),
}))
import { noteExtensions } from '@/components/notes/extensions'
import { noteImages } from '@/components/notes/noteImage'
import { applyMarkup } from '@/components/notes/markupFlow'

const editors: Editor[] = []
const make = (md: string) => { const e = new Editor({ extensions: noteExtensions(), content: md, contentType: 'markdown' }); editors.push(e); return e }
const sb = {} as SupabaseClient
const blob = new Blob(['x'], { type: 'image/webp' })
beforeEach(() => { upload.mockClear().mockResolvedValue('studyhub-image:new.webp'); remove.mockClear().mockResolvedValue(undefined) })
afterEach(() => { while (editors.length) editors.pop()!.destroy() })

describe('putting finished markup in the note', () => {
  it('swaps the marked-up picture in for the one it started from and removes the old file', async () => {
    const e = make('Intro\n\n![Cell](studyhub-image:old.webp)\n\nEnd')
    const [img] = noteImages(e)
    await applyMarkup(e, sb, 'u1', { kind: 'edit', pos: img.pos, src: img.src }, blob)
    expect(e.getMarkdown()).toBe('Intro\n\n![Cell](studyhub-image:new.webp)\n\nEnd') // same place, same description
    expect(upload).toHaveBeenCalledWith(sb, 'u1', blob)
    expect(remove).toHaveBeenCalledWith(sb, 'u1', ['old.webp'])
  })
  it('keeps the old file while another picture in the note still uses it', async () => {
    const e = make('![a](studyhub-image:old.webp)\n\n![b](studyhub-image:old.webp)')
    const [first] = noteImages(e)
    await applyMarkup(e, sb, 'u1', { kind: 'edit', pos: first.pos, src: first.src }, blob)
    expect(noteImages(e).map(i => i.src)).toEqual(['studyhub-image:new.webp', 'studyhub-image:old.webp'])
    expect(remove).not.toHaveBeenCalled()
  })
  it('finds the picture again when the note moved on while the tool was open', async () => {
    const e = make('![Cell](studyhub-image:old.webp)')
    const [img] = noteImages(e)
    e.commands.insertContentAt(0, 'A new first line. ') // pushes the picture along
    await applyMarkup(e, sb, 'u1', { kind: 'edit', pos: img.pos, src: img.src }, blob)
    expect(e.getMarkdown()).toContain('studyhub-image:new.webp')
    expect(e.getMarkdown()).not.toContain('old.webp')
  })
  it('puts a new picture in when the original was taken out meanwhile, and removes nothing', async () => {
    const e = make('Just text')
    await applyMarkup(e, sb, 'u1', { kind: 'edit', pos: 3, src: 'studyhub-image:gone.webp' }, blob)
    expect(e.getMarkdown()).toContain('studyhub-image:new.webp')
    expect(remove).not.toHaveBeenCalled()
  })
  it('puts a sketch in at the cursor, called a drawing', async () => {
    const e = make('Hello')
    await applyMarkup(e, sb, 'u1', { kind: 'draw' }, blob)
    expect(e.getMarkdown()).toContain('![Drawing](studyhub-image:new.webp)')
    expect(remove).not.toHaveBeenCalled()
  })
  it('does not fail the save if clearing the old file fails', async () => {
    remove.mockRejectedValue(new Error('offline'))
    const e = make('![Cell](studyhub-image:old.webp)')
    const [img] = noteImages(e)
    await expect(applyMarkup(e, sb, 'u1', { kind: 'edit', pos: img.pos, src: img.src }, blob)).resolves.toBeUndefined()
    expect(e.getMarkdown()).toContain('new.webp')
  })
  it('leaves the note alone when the upload fails', async () => {
    upload.mockRejectedValue(new Error('offline'))
    const e = make('![Cell](studyhub-image:old.webp)')
    const [img] = noteImages(e)
    await expect(applyMarkup(e, sb, 'u1', { kind: 'edit', pos: img.pos, src: img.src }, blob)).rejects.toThrow('offline')
    expect(e.getMarkdown()).toContain('old.webp')
    expect(remove).not.toHaveBeenCalled()
  })
})
