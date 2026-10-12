import { describe, it, expect, vi } from 'vitest'

const lib = vi.hoisted(() => ({ loadLibrary: vi.fn() }))
const top = vi.hoisted(() => ({ listTopicStats: vi.fn() }))
vi.mock('@/lib/data/library', () => lib)
vi.mock('@/lib/data/topics', () => top)
import { loadCoursePage } from '@/lib/data/coursePage'

const ID = '11111111-1111-4111-8111-111111111111'
const NOW = new Date('2026-10-12T10:00:00Z')
const item = (id: string, course: string | null) => ({ kind: 'note' as const, id, title: id, course_id: course, at: '', meta: '', href: '' })

// A stand-in client: courses and tasks reads end in `.maybeSingle()` / `.limit()`
function client(opts: { course?: unknown; courseError?: boolean; exam?: unknown[] }) {
  const log: string[] = []
  const from = (table: string) => {
    const q: Record<string, unknown> = {}
    for (const k of ['select', 'eq', 'is', 'gt', 'order']) q[k] = (...a: unknown[]) => { log.push(`${table}.${k}(${a.map(String).join(",")})`); return q }
    q.maybeSingle = () => Promise.resolve(opts.courseError ? { data: null, error: { message: 'x' } } : { data: opts.course ?? null, error: null })
    q.limit = () => Promise.resolve({ data: opts.exam ?? [], error: null })
    return q
  }
  return { sb: { from } as never, log }
}

describe('loadCoursePage', () => {
  it('is null for an id that is not a course id, without asking the database', async () => {
    const c = client({})
    expect(await loadCoursePage(c.sb, 'nope', NOW)).toBeNull()
    expect(c.log).toEqual([])
  })
  it('is null when there is no such course', async () => {
    lib.loadLibrary.mockResolvedValue([]); top.listTopicStats.mockResolvedValue([])
    expect(await loadCoursePage(client({ course: null }).sb, ID, NOW)).toBeNull()
  })
  it('keeps only this course items, its topics and its next unfinished future exam', async () => {
    lib.loadLibrary.mockResolvedValue([item('a', ID), item('b', 'other'), item('c', null)])
    top.listTopicStats.mockResolvedValue([{ topic_id: 't' }])
    const c = client({ course: { id: ID, name: 'Biology', color: '#123456' }, exam: [{ id: 'x', title: 'Midterm', due_at: '2026-10-21T10:00:00Z' }] })
    const page = await loadCoursePage(c.sb, ID, NOW)
    expect(page!.course.name).toBe('Biology')
    expect(page!.items!.map(i => i.id)).toEqual(['a'])
    expect(page!.topics).toEqual([{ topic_id: 't' }])
    expect(page!.exam).toEqual({ id: 'x', title: 'Midterm', due_at: '2026-10-21T10:00:00Z' })
    expect(c.log).toContain('tasks.eq(type,exam)')
    expect(c.log).toContain('tasks.is(done_at,null)')
    expect(c.log).toContain('tasks.gt(due_at,2026-10-12T10:00:00.000Z)')
  })
  it('still gives the course when the items or topics fail to load', async () => {
    lib.loadLibrary.mockRejectedValue(new Error('x')); top.listTopicStats.mockRejectedValue(new Error('x'))
    const page = await loadCoursePage(client({ course: { id: ID, name: 'Biology', color: '#123456' } }).sb, ID, NOW)
    expect(page!.items).toBeNull()
    expect(page!.topics).toBeNull()
    expect(page!.exam).toBeNull()
  })
  it('throws when the course itself cannot be read', async () => {
    lib.loadLibrary.mockResolvedValue([]); top.listTopicStats.mockResolvedValue([])
    await expect(loadCoursePage(client({ courseError: true }).sb, ID, NOW)).rejects.toBeTruthy()
  })
})
