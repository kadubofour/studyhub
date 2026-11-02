import { describe, it, expect, beforeAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { newUser } from './helpers'
import { createNotebook, deleteNotebook, listNotebooks } from '@/lib/data/notebooks'
import { createNote } from '@/lib/data/notes'

type U = { sb: SupabaseClient; id: string }
let A: U, B: U
beforeAll(async () => { A = await newUser(); B = await newUser() })

const general = async (u: U) => (await listNotebooks(u.sb)).filter(b => b.is_default)

describe('everything is in a notebook', () => {
  it('a student with nothing has no notebooks; the first thing they make makes their General notebook, once', async () => {
    expect(await listNotebooks(A.sb)).toEqual([])
    const n1 = await createNote(A.sb, { title: 'One', content_md: 'x' })
    const n2 = await createNote(A.sb, { title: 'Two', content_md: 'y' })
    const g = await general(A)
    expect(g).toHaveLength(1)
    expect(g[0].name).toBe('General')
    expect(n1.notebook_id).toBe(g[0].id)
    expect(n2.notebook_id).toBe(g[0].id)
  })

  it('a deck, a lecture and a file made without a notebook go in General; one made in a notebook stays there', async () => {
    const g = (await general(A))[0]
    const book = await createNotebook(A.sb, 'Cell biology')
    const deck = (await A.sb.from('decks').insert({ name: 'Loose' }).select('notebook_id').single()).data!
    const filed = (await A.sb.from('decks').insert({ name: 'Filed', notebook_id: book.id }).select('notebook_id').single()).data!
    const lecture = (await A.sb.from('lectures').insert({ title: 'Week 1', duration_seconds: 60 }).select('notebook_id').single()).data
    const file = await A.sb.from('materials').insert({ name: 'a.pdf', mime: 'application/pdf', bytes: 10, path: `${A.id}/${crypto.randomUUID()}-a.pdf` }).select('notebook_id').single()
    expect(deck.notebook_id).toBe(g.id)
    expect(filed.notebook_id).toBe(book.id)
    if (lecture) expect(lecture.notebook_id).toBe(g.id)
    expect(file.data?.notebook_id).toBe(g.id)
  })

  it('taking something out of a notebook puts it in General, never nowhere', async () => {
    const g = (await general(A))[0]
    const book = await createNotebook(A.sb, 'Temp')
    const d = (await A.sb.from('decks').insert({ name: 'Moves', notebook_id: book.id }).select('id').single()).data!
    await A.sb.from('decks').update({ notebook_id: null }).eq('id', d.id)
    expect((await A.sb.from('decks').select('notebook_id').eq('id', d.id).single()).data!.notebook_id).toBe(g.id)
  })

  it('deleting a notebook moves what it held to General; General cannot be deleted or faked', async () => {
    const g = (await general(A))[0]
    const book = await createNotebook(A.sb, 'Going')
    const note = await createNote(A.sb, { title: 'Stays', content_md: 'z', notebook_id: book.id })
    const deck = (await A.sb.from('decks').insert({ name: 'Also stays', notebook_id: book.id }).select('id').single()).data!
    await deleteNotebook(A.sb, book.id)
    expect((await A.sb.from('notes').select('notebook_id').eq('id', note.id).single()).data!.notebook_id).toBe(g.id)
    expect((await A.sb.from('decks').select('notebook_id').eq('id', deck.id).single()).data!.notebook_id).toBe(g.id)
    expect((await A.sb.from('notebooks').delete().eq('id', g.id)).error).toBeTruthy()
    expect((await A.sb.from('notebooks').update({ is_default: false }).eq('id', g.id)).error).toBeTruthy()
    expect((await A.sb.from('notebooks').insert({ name: 'Fake', is_default: true })).error).toBeTruthy()
    expect(await general(A)).toHaveLength(1)
  })

  it('a thing cannot be put in another student\'s notebook', async () => {
    const mine = await createNotebook(A.sb, 'Private')
    const theirs = (await B.sb.from('decks').insert({ name: 'Theirs' }).select('id').single()).data!
    expect((await B.sb.from('decks').update({ notebook_id: mine.id }).eq('id', theirs.id)).error).toBeTruthy()
    expect((await B.sb.from('decks').insert({ name: 'Sneaky', notebook_id: mine.id })).error).toBeTruthy()
  })
})
