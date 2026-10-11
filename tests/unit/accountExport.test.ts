import { describe, it, expect, vi } from 'vitest'
import { EXPORT_TABLES, exportMyData } from '@/lib/account/export'

// A stand-in client: every table has the rows given, served in pages like PostgREST does
function client(rows: Record<string, unknown[]>, fail?: string) {
  const asked: { table: string; select: string; from: number; to: number }[] = []
  const from = (table: string) => {
    let range: [number, number] = [0, 999]
    const q: Record<string, unknown> = {}
    q.select = () => q
    q.order = () => q
    q.eq = () => q
    q.range = (a: number, b: number) => { range = [a, b]; return q }
    q.then = (res: (v: unknown) => unknown) => {
      asked.push({ table, select: '*', from: range[0], to: range[1] })
      if (table === fail) return res({ data: null, error: { message: 'boom' } })
      return res({ data: (rows[table] ?? []).slice(range[0], range[1] + 1), error: null })
    }
    return q
  }
  return { sb: { from } as never, asked }
}

describe('exportMyData', () => {
  it('reads every table the student owns, and says what it is', async () => {
    const { sb } = client({ notes: [{ id: 'n1', title: 'Krebs' }], cards: [{ id: 'c1' }] })
    const out = await exportMyData(sb, new Date('2026-10-11T10:00:00Z'))
    expect(out.app).toBe('Studyhub')
    expect(out.exported_at).toBe('2026-10-11T10:00:00.000Z')
    expect(Object.keys(out.data)).toEqual([...EXPORT_TABLES])
    expect(out.data.notes).toEqual([{ id: 'n1', title: 'Krebs' }])
    expect(out.data.cards).toEqual([{ id: 'c1' }])
    expect(out.data.reviews).toEqual([])
  })
  it('covers the tables with personal content, and never the billing tokens', () => {
    for (const t of ['profiles', 'notes', 'cards', 'lectures', 'tutor_messages', 'quiz_attempts', 'topic_resources', 'game_plays', 'tasks']) expect(EXPORT_TABLES).toContain(t)
    expect(EXPORT_TABLES).not.toContain('entitlements')
    expect(EXPORT_TABLES).not.toContain('ai_charges')
  })
  it('reads long tables page by page so nothing is cut off at 1000 rows', async () => {
    const reviews = Array.from({ length: 2500 }, (_, i) => ({ id: `r${i}` }))
    const { sb, asked } = client({ reviews })
    const out = await exportMyData(sb)
    expect(out.data.reviews).toHaveLength(2500)
    expect(asked.filter(a => a.table === 'reviews').map(a => a.from)).toEqual([0, 1000, 2000])
  })
  it('fails as a whole, naming the table, if one table cannot be read', async () => {
    const { sb } = client({}, 'notes')
    await expect(exportMyData(sb)).rejects.toThrow(/notes/)
  })
})

describe('the export file', () => {
  it('is plain JSON a student can open', async () => {
    const { sb } = client({ notes: [{ id: 'n1', title: 'Café' }] })
    const text = JSON.stringify(await exportMyData(sb), null, 2)
    expect(JSON.parse(text).data.notes[0].title).toBe('Café')
    void vi
  })
})
