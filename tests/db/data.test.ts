import { describe, it, expect, beforeAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { newUser } from './helpers'
import { createCourse, deleteCourse, listCourses } from '@/lib/data/courses'
import { createTask, listOpenTasks, setTaskDone, countTasksDoneSince } from '@/lib/data/tasks'
import { createClass, listClasses } from '@/lib/data/classes'
import { createNote, listNotes, getNote, updateNote, searchNotes, getNotesForExport } from '@/lib/data/notes'
import { createDeck, listDecksWithDue, getDeck } from '@/lib/data/decks'
import { createCards, listDueCards, rateCard, countDueCards, listCards } from '@/lib/data/cards'
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

describe('large histories (PostgREST returns at most 1000 rows per request)', () => {
  it('lists every session, including the newest, beyond 1000 rows', async () => {
    const heavy = (await newUser()).sb
    const base = Date.UTC(2026, 0, 1)
    const rows = Array.from({ length: 1100 }, (_, i) => {
      const start = new Date(base + i * 3_600_000)
      return { started_at: start.toISOString(), ended_at: new Date(start.getTime() + 25 * 60_000).toISOString(), minutes: 25, completed: true }
    })
    const { error } = await heavy.from('focus_sessions').insert(rows)
    expect(error).toBeNull()
    const list = await listSessionsSince(heavy, new Date(base - 1000))
    expect(list).toHaveLength(1100)
    expect(new Date(list.at(-1)!.started_at).getTime()).toBe(base + 1099 * 3_600_000)
  })
  it('counts due cards per deck beyond 1000 cards', async () => {
    const heavy = (await newUser()).sb
    const d = await createDeck(heavy, { name: 'Big' })
    await createCards(heavy, d.id, Array.from({ length: 1050 }, (_, i) => ({ front: `q${i}`, back: `a${i}` })))
    const decks = await listDecksWithDue(heavy, new Date(Date.now() + 1000))
    expect(decks.find(x => x.id === d.id)).toMatchObject({ total: 1050, due: 1050 })
  })
})

describe('notes for export', () => {
  it('loads full notes by id in the order asked, or all notes when no ids are given', async () => {
    const u = (await newUser()).sb
    const a = await createNote(u, { title: 'A', content_md: 'alpha' })
    const b = await createNote(u, { title: 'B', content_md: 'beta' })
    expect((await getNotesForExport(u, [b.id, a.id])).map(n => n.title)).toEqual(['B', 'A'])
    expect((await getNotesForExport(u)).map(n => n.content_md).sort()).toEqual(['alpha', 'beta'])
  })
})

describe('home stats', () => {
  it('counts tasks completed since a time', async () => {
    const u = (await newUser()).sb
    const since = new Date(Date.now() - 1000)
    const a = await createTask(u, { title: 'a' })
    await createTask(u, { title: 'b' })
    await setTaskDone(u, a.id, true)
    expect(await countTasksDoneSince(u, since)).toBe(1)
  })
})

describe('appearance settings', () => {
  it('defaults to blue + sans, saves a chosen accent and font, and rejects unknown ones', async () => {
    const u = await newUser()
    const { data: p } = await u.sb.from('profiles').select('accent,font').eq('id', u.id).single()
    expect(p).toEqual({ accent: 'blue', font: 'sans' })
    const ok = await u.sb.from('profiles').update({ accent: 'teal', font: 'serif' }).eq('id', u.id)
    expect(ok.error).toBeNull()
    const bad = await u.sb.from('profiles').update({ accent: 'neon' }).eq('id', u.id)
    expect(bad.error).not.toBeNull()
  })
  it('defaults to the Classic look, saves Paper, and rejects unknown looks', async () => {
    const u = await newUser()
    const { data: p } = await u.sb.from('profiles').select('look').eq('id', u.id).single()
    expect(p).toEqual({ look: 'classic' })
    expect((await u.sb.from('profiles').update({ look: 'paper' }).eq('id', u.id)).error).toBeNull()
    expect((await u.sb.from('profiles').select('look').eq('id', u.id).single()).data).toEqual({ look: 'paper' })
    expect((await u.sb.from('profiles').update({ look: 'neon' }).eq('id', u.id)).error).not.toBeNull()
  })
})

describe('review fixes', () => {
  it('logging the same focus session twice (two tabs / retry) stores it once', async () => {
    const u = (await newUser()).sb
    const start = new Date('2026-10-02T09:00:00Z')
    const s = { startedAt: start, endedAt: new Date(start.getTime() + 25 * 60_000), minutes: 25, completed: true }
    await logFocusSession(u, s)
    await logFocusSession(u, s)
    expect(await listSessionsSince(u, new Date(start.getTime() - 1000))).toHaveLength(1)
  })

  it('rating is atomic: if the review cannot be recorded, the card is not rescheduled', async () => {
    const d = await createDeck(sb, { name: 'Atomic' })
    const [card] = await createCards(sb, d.id, [{ front: 'q', back: 'a' }])
    await expect(rateCard(sb, card, 5 as never, new Date())).rejects.toBeTruthy()
    const after = await listCards(sb, d.id)
    expect(after[0]).toMatchObject({ reps: 0, interval_days: 0 })
  })

  it('rating is atomic: if rescheduling fails after the review was written, the review is rolled back', async () => {
    const d = await createDeck(sb, { name: 'Atomic 2' })
    const [card] = await createCards(sb, d.id, [{ front: 'q', back: 'a' }])
    const since = new Date(Date.now() - 1000)
    // The review insert (first statement) succeeds; the card update (second) violates reps >= 0
    const { error } = await sb.rpc('rate_card', {
      p_card_id: card.id, p_due_at: new Date().toISOString(), p_interval_days: 1, p_ease: 2.5, p_reps: -1,
      p_lapses: 0, p_rating: 3, p_reviewed_at: new Date().toISOString(), p_prev_interval_days: 0,
    })
    expect(error).not.toBeNull()
    expect((await listReviewsSince(sb, since)).filter(r => r.card_id === card.id)).toEqual([])
  })

  it('rejects an invalid time zone', async () => {
    const u = await newUser()
    const { error } = await u.sb.from('profiles').update({ timezone: 'Mars/Olympus_Mons' }).eq('id', u.id)
    expect(error).not.toBeNull()
  })

  it('falls back to UTC when signup sends an invalid time zone', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
    const { data } = await c.auth.signUp({ email: `t-${crypto.randomUUID()}@example.test`, password: 'local-test-pass-123', options: { data: { timezone: 'Not/AZone' } } })
    const { data: p } = await c.from('profiles').select('timezone').eq('id', data.user!.id).single()
    expect(p?.timezone).toBe('UTC')
  })

  it('searches note content, not just titles, and treats commas safely', async () => {
    const n = await createNote(sb, { title: 'Week 3', content_md: 'The Krebs cycle, aka citric acid cycle' })
    expect((await searchNotes(sb, 'krebs')).map(x => x.id)).toContain(n.id)
    expect((await searchNotes(sb, 'cycle, aka')).map(x => x.id)).toContain(n.id)
    expect((await searchNotes(sb, 'zzz-nothing')).map(x => x.id)).not.toContain(n.id)
  })

  it('search treats % and _ literally', async () => {
    const u = (await newUser()).sb
    const hit = await createNote(u, { title: 'Scores', content_md: 'got 50% on snake_case quiz' })
    const miss = await createNote(u, { title: 'Other', content_md: 'got 500 on snakeXcase' })
    const pct = (await searchNotes(u, '50%')).map(n => n.id)
    expect(pct).toContain(hit.id)
    expect(pct).not.toContain(miss.id)
    const us = (await searchNotes(u, 'snake_case')).map(n => n.id)
    expect(us).toContain(hit.id)
    expect(us).not.toContain(miss.id)
  })

  it('getDeck loads one deck without scanning every card', async () => {
    const d = await createDeck(sb, { name: 'Solo' })
    expect(await getDeck(sb, d.id)).toMatchObject({ id: d.id, name: 'Solo' })
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
