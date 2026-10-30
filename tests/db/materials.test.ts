import { describe, it, expect, beforeAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { newUser } from './helpers'
import { createNote } from '@/lib/data/notes'
import { deleteMaterial, getMaterial, keepMaterial, listMaterials, materialUrl } from '@/lib/data/materials'
import { loadLibrary, moveItems } from '@/lib/data/library'

let A: { sb: SupabaseClient; id: string }
let B: { sb: SupabaseClient; id: string }
const pdf = (name = 'Week 3 slides.pdf') => new File(['%PDF-1.4 a small file'], name, { type: 'application/pdf' })

beforeAll(async () => { A = await newUser(); B = await newUser() })

describe('kept uploads', () => {
  it('keeps the original beside the note made from it, and shows it in the Library', async () => {
    const note = await createNote(A.sb, { title: 'Week 3', content_md: 'x', course_id: null })
    const m = await keepMaterial(A.sb, A.id, pdf(), 'pdf', { course_id: null, note_id: note.id })
    expect(m).toMatchObject({ name: 'Week 3 slides.pdf', mime: 'application/pdf', note_id: note.id })
    expect(m.path.startsWith(`${A.id}/`)).toBe(true)
    expect((await A.sb.storage.from('materials').download(m.path)).error).toBeNull()
    expect(await materialUrl(A.sb, m)).toMatch(/^http/)
    const lib = await loadLibrary(A.sb, new Date())
    expect(lib.find(i => i.kind === 'file' && i.id === m.id)).toMatchObject({ title: 'Week 3 slides.pdf', href: `/files/${m.id}` })
  })
  it('keeps a Markdown file as Markdown', async () => {
    const m = await keepMaterial(A.sb, A.id, new File(['# hi'], 'notes.md'), 'text', { course_id: null, note_id: null })
    expect(m.mime).toBe('text/markdown')
  })
  it('moves with the Library\'s Move to, like everything else', async () => {
    const { data: course } = await A.sb.from('courses').insert({ name: 'Bio', color: '#2b6cb0' }).select('id').single()
    const m = await keepMaterial(A.sb, A.id, pdf(), 'pdf', { course_id: null, note_id: null })
    expect(await moveItems(A.sb, [{ kind: 'file', id: m.id }], course!.id)).toBe(1)
    expect((await getMaterial(A.sb, m.id)).course_id).toBe(course!.id)
  })
  it('stays when its note is deleted', async () => {
    const note = await createNote(A.sb, { title: 'Gone', content_md: 'x', course_id: null })
    const m = await keepMaterial(A.sb, A.id, pdf(), 'pdf', { course_id: null, note_id: note.id })
    await A.sb.from('notes').delete().eq('id', note.id)
    expect((await getMaterial(A.sb, m.id)).note_id).toBeNull()
  })
  it('deletes the file and its row together', async () => {
    const m = await keepMaterial(A.sb, A.id, pdf(), 'pdf', { course_id: null, note_id: null })
    await deleteMaterial(A.sb, m)
    expect((await listMaterials(A.sb)).some(x => x.id === m.id)).toBe(false)
    expect((await A.sb.storage.from('materials').download(m.path)).data).toBeNull()
  })
  it('is private: another student cannot list, read, sign or delete it, or point a row at it', async () => {
    const m = await keepMaterial(A.sb, A.id, pdf(), 'pdf', { course_id: null, note_id: null })
    expect((await listMaterials(B.sb)).some(x => x.id === m.id)).toBe(false)
    expect((await B.sb.storage.from('materials').download(m.path)).data).toBeNull()
    expect((await B.sb.storage.from('materials').createSignedUrl(m.path, 60)).data).toBeNull()
    await B.sb.storage.from('materials').remove([m.path])
    await B.sb.from('materials').delete().eq('id', m.id)
    expect((await A.sb.storage.from('materials').download(m.path)).error).toBeNull()
    expect((await getMaterial(A.sb, m.id)).id).toBe(m.id)
    // a row of B's that names A's file is refused
    const { error } = await B.sb.from('materials').insert({ name: 'x.pdf', mime: 'application/pdf', bytes: 1, path: `${A.id}/stolen.pdf` })
    expect(error).not.toBeNull()
    // and B cannot write into A's folder
    expect((await B.sb.storage.from('materials').upload(`${A.id}/x.pdf`, pdf(), { contentType: 'application/pdf' })).error).not.toBeNull()
  })
  it('only takes PDF, Word, PowerPoint and text files', async () => {
    const { error } = await A.sb.storage.from('materials').upload(`${A.id}/x.png`, new Blob(['x'], { type: 'image/png' }), { contentType: 'image/png' })
    expect(error).not.toBeNull()
  })
})
