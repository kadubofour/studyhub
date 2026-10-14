import { describe, it, expect } from 'vitest'
import { newUser } from './helpers'

const stroke = { id: 'm1', kind: 'pen', color: '#dc2626', size: 'M', points: [[10, 10], [200, 80]] }

describe('ink drawn on a note', () => {
  it('starts empty and keeps the marks the student draws', async () => {
    const u = await newUser()
    const { data: note } = await u.sb.from('notes').insert({ title: 'Inked', content_md: 'x' }).select('id,ink').single()
    expect(note!.ink).toEqual([])
    expect((await u.sb.from('notes').update({ ink: [stroke] }).eq('id', note!.id)).error).toBeNull()
    const { data } = await u.sb.from('notes').select('ink').eq('id', note!.id).single()
    expect(data!.ink).toEqual([stroke])
  })
  it('refuses ink that is not a list, or is far too big', async () => {
    const u = await newUser()
    const { data: note } = await u.sb.from('notes').insert({ title: 'Inked', content_md: 'x' }).select('id').single()
    expect((await u.sb.from('notes').update({ ink: { a: 1 } }).eq('id', note!.id)).error).not.toBeNull()
    expect((await u.sb.from('notes').update({ ink: Array.from({ length: 4001 }, () => stroke) }).eq('id', note!.id)).error).not.toBeNull()
  })
  it('is private to the student, like the note', async () => {
    const a = await newUser(), b = await newUser()
    const { data: note } = await a.sb.from('notes').insert({ title: 'Mine', content_md: 'x', ink: [stroke] }).select('id').single()
    expect((await b.sb.from('notes').select('ink').eq('id', note!.id)).data).toEqual([])
    await b.sb.from('notes').update({ ink: [] }).eq('id', note!.id)
    expect((await a.sb.from('notes').select('ink').eq('id', note!.id).single()).data!.ink).toEqual([stroke])
  })
})
