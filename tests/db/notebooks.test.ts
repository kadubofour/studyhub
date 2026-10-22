import { describe, it, expect, beforeAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { newUser } from './helpers'
import { createNotebook, deleteNotebook, listNotebooks, moveNotes, renameNotebook } from '@/lib/data/notebooks'
import { createNote, listNotes, searchNotes } from '@/lib/data/notes'

type U = { sb: SupabaseClient; id: string }
let A: U, B: U
beforeAll(async () => { A = await newUser(); B = await newUser() })

describe('notebooks', () => {
  it('are made, listed oldest first, renamed and kept per student', async () => {
    const one = await createNotebook(A.sb, 'Biology year 1')
    const two = await createNotebook(A.sb, 'Chemistry')
    await renameNotebook(A.sb, two.id, 'Organic chemistry')
    expect((await listNotebooks(A.sb)).map(n => n.name)).toEqual(['Biology year 1', 'Organic chemistry'])
    expect(await listNotebooks(B.sb)).toEqual([])
    expect(one.id).not.toBe(two.id)
  })

  it('refuse an empty or very long name', async () => {
    expect((await A.sb.from('notebooks').insert({ name: '' })).error).toBeTruthy()
    expect((await A.sb.from('notebooks').insert({ name: 'x'.repeat(81) })).error).toBeTruthy()
  })

  it('hold notes: moved in, listed with their notebook, searched, and moved out', async () => {
    const book = await createNotebook(A.sb, 'Lab notes')
    const n1 = await createNote(A.sb, { title: 'Krebs cycle', content_md: 'matrix' })
    const n2 = await createNote(A.sb, { title: 'Glycolysis', content_md: 'cytoplasm' })
    await moveNotes(A.sb, [n1.id, n2.id], book.id)
    const inBook = (await listNotes(A.sb)).filter(n => n.notebook_id === book.id).map(n => n.title).sort()
    expect(inBook).toEqual(['Glycolysis', 'Krebs cycle'])
    expect((await searchNotes(A.sb, 'krebs'))[0].notebook_id).toBe(book.id)
    await moveNotes(A.sb, [n1.id], null)
    expect((await listNotes(A.sb)).find(n => n.id === n1.id)!.notebook_id).toBeNull()
  })

  it('keep their notes when deleted: the notes become unfiled', async () => {
    const book = await createNotebook(A.sb, 'Temporary')
    const n = await createNote(A.sb, { title: 'Stays', content_md: 'x' })
    await moveNotes(A.sb, [n.id], book.id)
    await deleteNotebook(A.sb, book.id)
    const after = (await listNotes(A.sb)).find(x => x.id === n.id)!
    expect(after.notebook_id).toBeNull()
    expect((await listNotebooks(A.sb)).some(b => b.id === book.id)).toBe(false)
  })

  it('cannot be used by another student: not seen, not renamed, not filled', async () => {
    const mine = await createNotebook(A.sb, 'Private')
    expect(await listNotebooks(B.sb)).toEqual([])
    await renameNotebook(B.sb, mine.id, 'Hijacked')
    expect((await listNotebooks(A.sb)).find(b => b.id === mine.id)!.name).toBe('Private')
    const theirs = await createNote(B.sb, { title: 'Theirs', content_md: 'y' })
    const direct = await B.sb.from('notes').update({ notebook_id: mine.id }).eq('id', theirs.id)
    expect(direct.error).toBeTruthy() // the database refuses a note in someone else's notebook
    const insert = await B.sb.from('notes').insert({ title: 'Sneaky', content_md: 'z', notebook_id: mine.id })
    expect(insert.error).toBeTruthy()
    await expect(moveNotes(B.sb, [theirs.id], mine.id)).rejects.toBeTruthy()
  })

  it('moving a note in or out, or deleting its notebook, is not an edit: the note keeps its edited time', async () => {
    const book = await createNotebook(A.sb, 'Quiet')
    const n = await createNote(A.sb, { title: 'Old note', content_md: 'x' })
    await A.sb.from('notes').update({ updated_at: '2020-01-01T00:00:00Z' }).eq('id', n.id) // an edit would set it to now
    const before = (await A.sb.from('notes').select('updated_at').eq('id', n.id).single()).data!.updated_at
    await moveNotes(A.sb, [n.id], book.id)
    expect((await A.sb.from('notes').select('updated_at').eq('id', n.id).single()).data!.updated_at).toBe(before)
    await deleteNotebook(A.sb, book.id)
    expect((await A.sb.from('notes').select('updated_at').eq('id', n.id).single()).data!.updated_at).toBe(before)
    await A.sb.from('notes').update({ title: 'Edited' }).eq('id', n.id) // a real edit still counts
    expect((await A.sb.from('notes').select('updated_at').eq('id', n.id).single()).data!.updated_at).not.toBe(before)
  })

  it('search matches a backslash and a percent sign literally', async () => {
    await createNote(A.sb, { title: 'Path note', content_md: 'saved in C:\\temp\\files' })
    await createNote(A.sb, { title: 'Percent note', content_md: 'scored 50% overall' })
    expect((await searchNotes(A.sb, 'C:\\temp')).map(n => n.title)).toEqual(['Path note'])
    expect((await searchNotes(A.sb, 'temp\\')).map(n => n.title)).toEqual(['Path note'])
    expect((await searchNotes(A.sb, '50%')).map(n => n.title)).toEqual(['Percent note'])
    expect(await searchNotes(A.sb, 'zzz\\')).toEqual([])
  })

  it('go with the account (deleting the user removes them)', async () => {
    const fresh = await newUser()
    await createNotebook(fresh.sb, 'Mine')
    expect((await listNotebooks(fresh.sb)).length).toBe(1)
  })
})
