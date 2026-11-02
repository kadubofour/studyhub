import { describe, expect, it } from 'vitest'
import { parseToolCall, toolDefinitions } from '@/lib/ai/tutorTools'
import { applyProposal } from '@/lib/tutor/apply'
import { tutorInstructions } from '@/lib/ai/tutorContext'

const COURSE = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'
const ctx = { noteId: null, courseIds: [COURSE], deckIds: [] }
const call = (name: string, args: unknown) => parseToolCall(name, JSON.stringify(args), ctx, 'p1')

describe('the tutor can propose a weekly class', () => {
  const ok = { course_id: COURSE, day_of_week: 1, start_time: '09:00', end_time: '10:30', location: 'LT 2', kind: 'lab' }
  it('as a pending proposal the student approves', () => {
    expect(call('create_class', ok)).toEqual({ id: 'p1', state: 'pending', tool: 'create_class', args: ok })
    expect(call('create_class', { ...ok, location: '', kind: undefined })).toMatchObject({ args: { location: null, kind: 'lecture' } })
  })
  it.each([
    ['a course that is not theirs', { ...ok, course_id: OTHER }],
    ['no course', { ...ok, course_id: undefined }],
    ['a day that is not a day', { ...ok, day_of_week: 7 }],
    ['a time that is not a time', { ...ok, start_time: '9am' }],
    ['an end before the start', { ...ok, start_time: '11:00', end_time: '10:00' }],
  ])('is refused for %s', (_n, args) => expect(call('create_class', args)).toBeNull())
  it('is saved in the timetable through the same function the student uses', async () => {
    const rows: unknown[] = []
    const sb = { from: () => ({ insert: (r: unknown) => { rows.push(r); return { select: () => ({ single: async () => ({ data: { id: 'c1', ...(r as object) }, error: null }) }) } } }) }
    const out = await applyProposal(sb as never, call('create_class', ok)!, { course_id: null, note_id: null })
    expect(out).toEqual({ itemId: 'c1', itemKind: 'class' })
    expect(rows[0]).toEqual(ok)
  })
})

describe('the tutor can propose a notebook', () => {
  it('with a name, and a course only if it is the student\'s', () => {
    expect(call('create_notebook', { name: 'Chemistry', course_id: COURSE })).toMatchObject({ tool: 'create_notebook', args: { name: 'Chemistry', course_id: COURSE } })
    expect(call('create_notebook', { name: 'Chemistry' })).toMatchObject({ args: { course_id: null } })
    expect(call('create_notebook', { name: 'Chemistry', course_id: OTHER })).toBeNull()
    expect(call('create_notebook', { name: '' })).toBeNull()
    expect(call('create_notebook', { name: 'x'.repeat(81) })).toBeNull()
  })
  it('is made when the student adds it', async () => {
    const rows: unknown[] = []
    const sb = { from: () => ({ insert: (r: unknown) => { rows.push(r); return { select: () => ({ single: async () => ({ data: { id: 'b1', name: 'Chemistry' }, error: null }) }) } } }) }
    const out = await applyProposal(sb as never, call('create_notebook', { name: 'Chemistry' })!, { course_id: COURSE, note_id: null })
    expect(out).toEqual({ itemId: 'b1', itemKind: 'notebook' })
    expect(rows[0]).toEqual({ name: 'Chemistry', course_id: COURSE })
  })
})

describe('what the model is offered', () => {
  it('has both tools, and tells the tutor it may propose them', () => {
    const names = toolDefinitions(false).map(t => (t as { name: string }).name)
    expect(names).toEqual(expect.arrayContaining(['create_class', 'create_notebook', 'create_task', 'create_note', 'create_flashcards']))
    expect(tutorInstructions(false)).toMatch(/weekly class for their timetable or a notebook/)
  })
})
