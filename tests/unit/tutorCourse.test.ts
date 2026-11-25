import { describe, expect, it, vi } from 'vitest'
import { courseMaterial } from '@/lib/ai/tutorCourse'

vi.mock('server-only', () => ({}))

type Rows = Record<string, Record<string, unknown>[]>
const client = (tables: Rows) => {
  const scopes: string[] = []
  const sb = {
    from: (table: string) => {
      const q: Record<string, unknown> = {}
      q.select = () => q; q.eq = () => q; q.limit = () => q
      q.or = (s: string) => { scopes.push(s); return q }
      q.then = (res: (v: unknown) => unknown) => res({ data: tables[table] ?? [], error: null })
      return q
    },
  }
  return { sb: sb as never, scopes }
}

describe('courseMaterial', () => {
  it('gathers the course\'s notes, lecture transcripts and files', async () => {
    const { sb } = client({
      notes: [{ id: 'n1', title: 'Week 1', content_md: 'Note text.' }],
      lectures: [{ id: 'l1', title: 'Talk', transcript: [{ start: 0, text: 'Spoken words.' }] }],
      materials: [{ id: 'f1', name: 'slides.pdf', body: 'File text.', note_id: null }],
    })
    const got = await courseMaterial(sb, 'C', [])
    expect(got.map(m => [m.kind, m.id, m.title])).toEqual([['note', 'n1', 'Week 1'], ['lecture', 'l1', 'Talk'], ['file', 'f1', 'slides.pdf']])
    expect(got[1].text).toContain('Spoken words.')
    expect(got[2].text).toBe('File text.')
  })
  it('looks in the course and in its notebooks', async () => {
    const { sb, scopes } = client({})
    await courseMaterial(sb, 'C', ['N1', 'N2'])
    expect(scopes).toEqual(Array(3).fill('course_id.eq.C,notebook_id.in.(N1,N2)'))
  })
  it('looks only in the course when it has no notebooks', async () => {
    const { sb, scopes } = client({})
    await courseMaterial(sb, 'C', [])
    expect(scopes[0]).toBe('course_id.eq.C')
  })
  it('leaves out a file whose note is already there, and keeps one whose note is elsewhere', async () => {
    const { sb } = client({
      notes: [{ id: 'n1', title: 'Made from it', content_md: 'Note.' }],
      materials: [{ id: 'f1', name: 'a.pdf', body: 'Same.', note_id: 'n1' }, { id: 'f2', name: 'b.pdf', body: 'Other.', note_id: 'elsewhere' }],
    })
    expect((await courseMaterial(sb, 'C', [])).map(m => m.id)).toEqual(['n1', 'f2'])
  })
  it('never stops the tutor: a failure means none', async () => {
    expect(await courseMaterial({ from: () => { throw new Error('down') } } as never, 'C', [])).toEqual([])
  })
})
