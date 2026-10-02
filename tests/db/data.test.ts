import { describe, it, expect, beforeAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { newUser } from './helpers'
import { createCourse, deleteCourse, listCourses } from '@/lib/data/courses'
import { createTask, listOpenTasks, setTaskDone } from '@/lib/data/tasks'
import { createClass, listClasses } from '@/lib/data/classes'
import { createNote, listNotes, getNote, updateNote } from '@/lib/data/notes'
import { createDeck, listDecksWithDue } from '@/lib/data/decks'
import { createCards, listDueCards, rateCard, countDueCards } from '@/lib/data/cards'
import { listReviewsSince } from '@/lib/data/reviews'
import { logFocusSession, listSessionsSince } from '@/lib/data/focus'

let sb: SupabaseClient
beforeAll(async () => { sb = (await newUser()).sb })

describe('courses', () => {
  it('delete keeping contents: tasks/notes/decks lose their course, classes are removed', async () => {
    const c = await createCourse(sb, { name: 'Bio', color: '#1D9E75' })
    const t = await createTask(sb, { title: 'Read', course_id: c.id })
    await createClass(sb, { course_id: c.id, day_of_week: 1, start_time: '10:00', end_time: '11:00', location: null, kind: 'lecture' })
    const n = await createNote(sb, { title: 'Cells', course_id: c.id })
    await deleteCourse(sb, c.id, { deleteContents: false })
    expect((await listCourses(sb)).find(x => x.id === c.id)).toBeUndefined()
    expect((await listOpenTasks(sb)).find(x => x.id === t.id)?.course_id).toBeNull()
    expect((await getNote(sb, n.id)).course_id).toBeNull()
    expect((await listClasses(sb)).filter(x => x.course_id === c.id)).toEqual([])
  })
  it('delete with contents removes tasks, notes and decks', async () => {
    const c = await createCourse(sb, { name: 'Chem', color: '#378ADD' })
    const t = await createTask(sb, { title: 'Lab', course_id: c.id })
    const n = await createNote(sb, { title: 'Acids', course_id: c.id })
    const d = await createDeck(sb, { name: 'Acids', course_id: c.id })
    await deleteCourse(sb, c.id, { deleteContents: true })
    expect((await listOpenTasks(sb)).find(x => x.id === t.id)).toBeUndefined()
    expect((await listNotes(sb)).find(x => x.id === n.id)).toBeUndefined()
    expect((await listDecksWithDue(sb, new Date())).find(x => x.id === d.id)).toBeUndefined()
  })
})

describe('tasks', () => {
  it('done tasks drop out of open tasks and can be undone', async () => {
    const t = await createTask(sb, { title: 'Essay', due_at: '2026-10-02T03:59:59Z', type: 'assignment' })
    await setTaskDone(sb, t.id, true)
    expect((await listOpenTasks(sb)).find(x => x.id === t.id)).toBeUndefined()
    await setTaskDone(sb, t.id, false)
    expect((await listOpenTasks(sb)).find(x => x.id === t.id)).toBeDefined()
  })
})

describe('notes', () => {
  it('updates content and bumps updated_at', async () => {
    const n = await createNote(sb, {})
    expect(n.title).toBe('Untitled')
    await new Promise(r => setTimeout(r, 20))
    await updateNote(sb, n.id, { content_md: '# Hi $x^2$' })
    const after = await getNote(sb, n.id)
    expect(after.content_md).toBe('# Hi $x^2$')
    expect(after.updated_at > n.updated_at).toBe(true)
  })
})

describe('cards', () => {
  it('createCards inserts a batch that is immediately due', async () => {
    const d = await createDeck(sb, { name: 'Vocab' })
    const cards = await createCards(sb, d.id, [{ front: 'chat', back: 'cat' }, { front: 'chien', back: 'dog' }])
    expect(cards).toHaveLength(2)
    const due = await listDueCards(sb, new Date(Date.now() + 1000), d.id)
    expect(due).toHaveLength(2)
    const decks = await listDecksWithDue(sb, new Date(Date.now() + 1000))
    expect(decks.find(x => x.id === d.id)).toMatchObject({ due: 2, total: 2 })
  })
  it('rateCard reschedules and records a review', async () => {
    const d = await createDeck(sb, { name: 'Rate' })
    const [card] = await createCards(sb, d.id, [{ front: 'q', back: 'a' }])
    const now = new Date()
    const before = await countDueCards(sb, new Date(now.getTime() + 1000))
    const updated = await rateCard(sb, card, 4, now)
    expect(updated.interval_days).toBe(4)
    expect(updated.reps).toBe(1)
    expect(await countDueCards(sb, new Date(now.getTime() + 1000))).toBe(before - 1)
    const reviews = await listReviewsSince(sb, new Date(now.getTime() - 60_000))
    expect(reviews.find(r => r.card_id === card.id)?.rating).toBe(4)
  })
})

describe('focus', () => {
  it('logs and lists sessions', async () => {
    const start = new Date()
    await logFocusSession(sb, { startedAt: start, endedAt: new Date(start.getTime() + 25 * 60_000), minutes: 25, completed: true })
    const list = await listSessionsSince(sb, new Date(start.getTime() - 1000))
    expect(list.at(-1)).toMatchObject({ minutes: 25, completed: true })
  })
})
