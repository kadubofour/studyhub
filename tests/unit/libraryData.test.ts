import { describe, it, expect } from 'vitest'
import { loadLibrary, moveItems } from '@/lib/data/library'

type Call = { table: string; op: string; arg?: unknown; col?: string; ids?: unknown[] }
// A stand-in client: reads give the rows for the table; writes are recorded
function client(rows: Record<string, unknown[]>, failOn?: string, gone: Set<string> = new Set()) {
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
    let touched: unknown[] = []
    q.in = (col: string, ids: unknown[]) => { calls.push({ table, op, arg, col, ids }); touched = ids; return q }
    q.then = (res: (v: unknown) => unknown) => {
      if (op !== 'select') {
        if (table === failOn) return res({ data: null, error: { message: 'x' } })
        // an update returns the rows it changed; ids in `gone` match nothing
        return res({ data: touched.filter(id => !gone.has(String(id))).map(id => ({ id })), error: null })
      }
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
    expect(by['deck:d1'].due).toBe(2)
    expect(by['lecture:l1']).toMatchObject({ href: '/lectures/l1', meta: '45 min' })
    expect(by['chat:c1']).toMatchObject({ title: 'Matrix?', href: '/tutor/c1', at: '2026-10-06T11:00:00Z' })
    expect(items).toHaveLength(5)
  })
  it('keeps the notebook a note is in, so the Library can show it inside its folder', async () => {
    const filed = { ...rows, notes: [{ ...rows.notes[0], notebook_id: 'nb1' }, { id: 'n2', course_id: null, title: 'Loose', updated_at: '2026-10-10T10:00:00Z', notebook_id: null }] }
    const items = await loadLibrary(client(filed).sb, NOW)
    expect(items.find(i => i.id === 'n1')!.notebook_id).toBe('nb1')
    expect(items.find(i => i.id === 'n2')!.notebook_id).toBeNull()
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
  it('changes the course of each kind, and never touches a quiz', async () => {
    const c = client({})
    await moveItems(c.sb, items, 'bio')
    const updates = c.calls.filter(k => k.op === 'update')
    expect(updates.map(k => [k.table, k.ids])).toEqual([['notes', ['n1', 'n2']], ['decks', ['d1']], ['lectures', ['l1']], ['tutor_chats', ['c1']]])
    for (const u of updates) expect(u.arg).toEqual({ course_id: 'bio' })
    expect(c.calls.some(k => k.table === 'quizzes')).toBe(false)
  })
  it('leaves topic links to the database, which drops them only when the course really changes', async () => {
    const c = client({})
    await moveItems(c.sb, items, 'bio')
    expect(c.calls.some(k => k.table === 'topic_links')).toBe(false)
  })
  it('can put things back in no course', async () => {
    const c = client({})
    await moveItems(c.sb, [{ kind: 'note', id: 'n1' }], null)
    expect(c.calls.find(k => k.op === 'update')!.arg).toEqual({ course_id: null })
  })
  it('says how many it really moved', async () => {
    expect(await moveItems(client({}).sb, items, 'bio')).toBe(5)
    expect(await moveItems(client({}, undefined, new Set(['n2', 'c1'])).sb, items, 'bio')).toBe(3) // two were deleted meanwhile
  })
  it('sends long selections in batches, so no request address grows too long', async () => {
    const many = Array.from({ length: 250 }, (_, i) => ({ kind: 'note' as const, id: `n${i}` }))
    const c = client({})
    expect(await moveItems(c.sb, many, 'bio')).toBe(250)
    const sizes = c.calls.filter(k => k.op === 'update').map(k => k.ids!.length)
    expect(sizes).toEqual([100, 100, 50])
  })
  it('does nothing for an empty or all-quiz selection', async () => {
    const c = client({})
    expect(await moveItems(c.sb, [], 'bio')).toBe(0)
    expect(await moveItems(c.sb, [{ kind: 'quiz', id: 'q1' }], 'bio')).toBe(0)
    expect(c.calls).toEqual([])
  })
  it('fails, and says so, when a change is refused', async () => {
    await expect(moveItems(client({}, 'decks').sb, items, 'bio')).rejects.toBeTruthy()
  })
})

describe('loadLibrary reads past one page', () => {
  it('keeps every note, lecture, chat and quiz even beyond 1000 of them', async () => {
    const notes = Array.from({ length: 2300 }, (_, i) => ({ id: `n${i}`, course_id: null, title: `Note ${i}`, updated_at: '2026-10-10T10:00:00Z' }))
    const quizzes = Array.from({ length: 1200 }, (_, i) => ({ id: `q${i}`, note_id: 'n0', title: `Quiz ${i}`, created_at: '2026-10-10T12:00:00Z' }))
    const chats = Array.from({ length: 1100 }, (_, i) => ({ id: `c${i}`, title: `Chat ${i}`, course_id: null, note_id: null, lecture_id: null, guided: false, created_at: '', updated_at: '2026-10-06T11:00:00Z' }))
    const items = await loadLibrary(client({ notes, quizzes, tutor_chats: chats, decks: [], cards: [], lectures: [] }).sb, NOW)
    expect(items.filter(i => i.kind === 'note')).toHaveLength(2300)
    expect(items.filter(i => i.kind === 'quiz')).toHaveLength(1200)
    expect(items.filter(i => i.kind === 'chat')).toHaveLength(1100)
  })
})
