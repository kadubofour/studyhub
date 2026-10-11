import { describe, it, expect } from 'vitest'
import { newUser } from './helpers'
import { EXPORT_TABLES, exportMyData } from '@/lib/account/export'

describe('exportMyData against the real database', () => {
  it('reads every table (names and id columns are real) and returns only the student\'s own rows', async () => {
    const u = await newUser(), other = await newUser()
    await u.sb.from('notes').insert({ title: 'Mine', content_md: 'x' })
    await other.sb.from('notes').insert({ title: 'Theirs', content_md: 'y' })
    const out = await exportMyData(u.sb)
    expect(Object.keys(out.data)).toEqual([...EXPORT_TABLES])
    expect((out.data.notes as { title: string }[]).map(n => n.title)).toEqual(['Mine'])
    expect((out.data.profiles as { id: string }[]).map(p => p.id)).toEqual([u.id])
  })
})
