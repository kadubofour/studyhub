import { describe, it, expect } from 'vitest'
import { loadLibrary, moveItems } from '@/lib/data/library'

type Call = { table: string; op: string; arg?: unknown; col?: string; ids?: unknown[] }
// A stand-in client: reads give the rows for the table; writes are recorded
function client(rows: Record<string, unknown[]>, failOn?: string) {
  const calls: Call[] = []
  const from = (table: string) => {
    let op = 'select'
    let arg: unknown
    let range: [number, number] | null = null
    const q: Record<string, unknown> = {}
    for (const k of ['select', 'order', 'eq', 'lte']) q[k] = () => q
    q.range = (a: number, b: number) => { range = [a, b]; return q }
    q.update = (patch: unknown) => { op = 'update'; arg = patch; return q }
    q.delete = () => { op = 'delete'; return q }
    q.in = (col: string, ids: unknown[]) => { calls.push({ table, op, arg, col, ids }); return q }
    q.then = (res: (v: unknown) => unknown) => {
      if (op !== 'select') return res({ error: table === failOn ? { message: 'x' } : null })
      const all = rows[table] ?? []
      return res({ data: range ? all.slice(range[0], range[1] + 1) : all, error: null })
    }
    return q
  }
  return { sb: { from } as never, calls }
}
const NOW = new Date('2026-10-12T10:00:00Z')

describe('loadLibrary', () => {
  const rows = {
    notes: [{ id: 'n1', course_id: 'bio', title: 'Krebs', updated_at: '2026-10-10T10:00:00Z' }],
    decks: [{ id: 'd1', course_id: null, name: 'Cells', created_at: '2026-10-09T10:00:00Z' }],
    cards: [{ deck_id: 'd1', due_at: '2026-10-01T00:00:00Z' }, { deck_id: 'd1', due_at: '2099-01-01T00:00:00Z' }, { deck_id: 'd1', due_at: '2026-10-02T00:00:00Z' }],
    lectures: [{ id: 'l1', course_id: 'bio', title: 'Week 3', recorded_at: '2026-10-07T10:00:00Z', duration_seconds: 2700, transcript_status: 'done', transcript_source: 'openai', audio_bytes: 1 }],
    quizzes: [{ id: 'q1', note_id: 'n1', title: 'Krebs quiz', created_at: '2026-10-10T12:00:00Z' }, { id: 'q2', note_id: 'gone', title: 'Orphan', created_at: '2026-10-10T13:00:00Z' }],
    tutor_chats: [{ id: 'c1', title: 'Matrix?', course_id: null, note_id: null, lecture_id: null, guided: false, created_at: '2026-10-06T10:00:00Z', updated_at: '2026-10-06T11:00:00Z' }],
  }
  it('lists every kind with a title, course, link and a short line about it', async () => {
    const items = await loadLibrary(client(rows).sb, NOW)
    const by = Object.fromEntries(items.map(i => [`${i.kind}:${i.id}`, i]))
    expect(by['note:n1']).toMatchObject({ title: 'Krebs', course_id: 'bio', href: '/notes/n1', at: '2026-10-10T10:00:00Z' })
    expect(by['deck:d1']).toMatchObject({ title: 'Cells', course_id: null, href: '/flashcards/d1', meta: '3 cards · 2 due', at: '2026-10-09T10:00:00Z' })
    expect(by['lecture:l1']).toMatchObject({ href: '/lectures/l1', meta: '45 min' })
    expect(by['chat:c1']).toMatchObject({ title: 'Matrix?', href: '/tutor/c1', at: '2026-10-06T11:00:00Z' })
    expect(items).toHaveLength(5)
  })
  it('gives a quiz its note\'s course, and leaves out a quiz whose note is gone', async () => {
    const items = await loadLibrary(client(rows).sb, NOW)
    const quiz = items.find(i => i.kind === 'quiz')!
    expect(quiz).toMatchObject({ id: 'q1', course_id: 'bio', href: '/quiz/q1', title: 'Krebs quiz' })
    expect(items.find(i => i.id === 'q2')).toBeUndefined()
  })
  it('says one card, in the singular, and no due when none are', async () => {
    const one = { ...rows, cards: [{ deck_id: 'd1', due_at: '2099-01-01T00:00:00Z' }] }
    const items = await loadLibrary(client(one).sb, NOW)
    expect(items.find(i => i.kind === 'deck')!.meta).toBe('1 card')
  })
  it('fails as a whole if one list cannot be read', async () => {
    const c = client(rows)
    const sb = { from: (t: string) => (t === 'lectures' ? { select: () => ({ order: () => Promise.resolve({ data: null, error: { message: 'x' } }) }) } : (c.sb as { from: (t: string) => unknown }).from(t)) } as never
    await expect(loadLibrary(sb, NOW)).rejects.toBeTruthy()
  })
})

describe('moveItems', () => {
  const items = [
    { kind: 'note' as const, id: 'n1' }, { kind: 'note' as const, id: 'n2' }, { kind: 'deck' as const, id: 'd1' },
    { kind: 'lecture' as const, id: 'l1' }, { kind: 'chat' as const, id: 'c1' }, { kind: 'quiz' as const, id: 'q1' },
  ]
  it('changes the course of each kind in one request, and never touches a quiz', async () => {
    const c = client({})
    await moveItems(c.sb, items, 'bio')
    const updates = c.calls.filter(k => k.op === 'update')
    expect(updates.map(k => [k.table, k.ids])).toEqual([['notes', ['n1', 'n2']], ['decks', ['d1']], ['lectures', ['l1']], ['tutor_chats', ['c1']]])
    for (const u of updates) expect(u.arg).toEqual({ course_id: 'bio' })
    expect(c.calls.some(k => k.table === 'quizzes')).toBe(false)
  })
  it('can put things back in no course', async () => {
    const c = client({})
    await moveItems(c.sb, [{ kind: 'note', id: 'n1' }], null)
    expect(c.calls.find(k => k.op === 'update')!.arg).toEqual({ course_id: null })
  })
  it('takes moved notes, lectures and decks out of the topics of their old course', async () => {
    const c = client({})
    await moveItems(c.sb, items, 'bio')
    const unlinks = c.calls.filter(k => k.table === 'topic_links' && k.op === 'delete')
    expect(unlinks.map(k => [k.col, k.ids])).toEqual([['note_id', ['n1', 'n2']], ['deck_id', ['d1']], ['lecture_id', ['l1']]])
  })
  it('does nothing for an empty or all-quiz selection', async () => {
    const c = client({})
    await moveItems(c.sb, [], 'bio')
    await moveItems(c.sb, [{ kind: 'quiz', id: 'q1' }], 'bio')
    expect(c.calls).toEqual([])
  })
  it('fails, and says so, when a change is refused', async () => {
    await expect(moveItems(client({}, 'decks').sb, items, 'bio')).rejects.toBeTruthy()
  })
})
