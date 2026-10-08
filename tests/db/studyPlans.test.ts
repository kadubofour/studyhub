import { describe, it, expect } from 'vitest'
import { newUser } from './helpers'

type U = Awaited<ReturnType<typeof newUser>>
const course = async (u: U, name = 'Biology') => (await u.sb.from('courses').insert({ name, color: '#1D9E75' }).select('id').single()).data!.id as string
const exam = async (u: U, courseId: string | null, type = 'exam') =>
  (await u.sb.from('tasks').insert({ title: 'Midterm', type, course_id: courseId, due_at: new Date(Date.now() + 14 * 86_400_000).toISOString() }).select('id').single()).data!.id as string
const plan = (u: U, courseId: string, examId: string, over: object = {}) =>
  u.sb.from('study_plans').insert({ course_id: courseId, exam_task_id: examId, ...over }).select('id').single()
const sessions = [{ id: 's1', topic_id: '11111111-1111-4111-8111-111111111111', kind: 'learn', minutes: 25, done_at: null }]

describe('study plans', () => {
  it('a student keeps their own plans; others cannot see or use them', async () => {
    const u = await newUser(), other = await newUser()
    const c = await course(u), e = await exam(u, c)
    const { data: p, error } = await plan(u, c, e)
    expect(error).toBeNull()
    expect((await other.sb.from('study_plans').select('id').eq('id', p!.id)).data).toEqual([])
    expect((await plan(other, c, e)).error).not.toBeNull() // someone else's course and exam
  })
  it('has sensible defaults, and rejects bad modes, minutes and days off', async () => {
    const u = await newUser()
    const c = await course(u), e = await exam(u, c)
    const { data: p } = await plan(u, c, e)
    expect((await u.sb.from('study_plans').select('mode,minutes_per_day,days_off').eq('id', p!.id).single()).data).toEqual({ mode: 'balanced', minutes_per_day: 45, days_off: [] })
    for (const bad of [{ mode: 'cram' }, { minutes_per_day: 5 }, { minutes_per_day: 241 }, { days_off: [7] }, { days_off: [-1] }]) {
      expect((await u.sb.from('study_plans').update(bad).eq('id', p!.id)).error, JSON.stringify(bad)).not.toBeNull()
    }
    expect((await u.sb.from('study_plans').update({ mode: 'deep', minutes_per_day: 120, days_off: [0, 6] }).eq('id', p!.id)).error).toBeNull()
  })
  it('is one plan per course, and the exam must be an exam task in that course', async () => {
    const u = await newUser()
    const c1 = await course(u, 'Bio'), c2 = await course(u, 'Chem')
    const e1 = await exam(u, c1)
    expect((await plan(u, c1, e1)).error).toBeNull()
    expect((await plan(u, c1, await exam(u, c1))).error).not.toBeNull() // a second plan for the course
    expect((await plan(u, c2, e1)).error).not.toBeNull()                 // the exam is in another course
    expect((await plan(u, c2, await exam(u, c2, 'assignment'))).error).not.toBeNull() // not an exam
    expect((await plan(u, c2, await exam(u, null))).error).not.toBeNull() // no course
  })
  it('deleting the exam, or the course, deletes the plan and its days', async () => {
    const u = await newUser()
    const c = await course(u), e = await exam(u, c)
    const { data: p } = await plan(u, c, e)
    await u.sb.from('study_plan_days').insert({ plan_id: p!.id, day: '2026-10-12', sessions })
    await u.sb.from('tasks').delete().eq('id', e)
    expect((await u.sb.from('study_plans').select('id').eq('id', p!.id)).data).toEqual([])
    expect((await u.sb.from('study_plan_days').select('id').eq('plan_id', p!.id)).data).toEqual([])
    const c2 = await course(u, 'Chem'), p2 = (await plan(u, c2, await exam(u, c2))).data!
    await u.sb.from('courses').delete().eq('id', c2)
    expect((await u.sb.from('study_plans').select('id').eq('id', p2.id)).data).toEqual([])
  })
})

describe('study plan days', () => {
  const setup = async () => {
    const u = await newUser()
    const c = await course(u), e = await exam(u, c)
    return { u, planId: (await plan(u, c, e)).data!.id as string }
  }
  it('holds one list per plan and day, private to the student', async () => {
    const { u, planId } = await setup()
    const other = await newUser()
    expect((await u.sb.from('study_plan_days').insert({ plan_id: planId, day: '2026-10-12', sessions })).error).toBeNull()
    expect((await u.sb.from('study_plan_days').insert({ plan_id: planId, day: '2026-10-12', sessions })).error).not.toBeNull()
    expect((await u.sb.from('study_plan_days').insert({ plan_id: planId, day: '2026-10-13', sessions: [] })).error).toBeNull()
    expect((await other.sb.from('study_plan_days').select('id').eq('plan_id', planId)).data).toEqual([])
    expect((await other.sb.from('study_plan_days').insert({ plan_id: planId, day: '2026-10-14', sessions: [] })).error).not.toBeNull()
  })
  it('opening the same day twice keeps the first list (upsert that ignores duplicates)', async () => {
    const { u, planId } = await setup()
    const first = [{ ...sessions[0], id: 'first' }], second = [{ ...sessions[0], id: 'second' }]
    await u.sb.from('study_plan_days').upsert({ plan_id: planId, day: '2026-10-12', sessions: first }, { onConflict: 'plan_id,day', ignoreDuplicates: true })
    await u.sb.from('study_plan_days').upsert({ plan_id: planId, day: '2026-10-12', sessions: second }, { onConflict: 'plan_id,day', ignoreDuplicates: true })
    const { data } = await u.sb.from('study_plan_days').select('sessions').eq('plan_id', planId).eq('day', '2026-10-12').single()
    expect((data!.sessions as { id: string }[])[0].id).toBe('first')
  })
  it('keeps sessions an array and can be updated to record what was done', async () => {
    const { u, planId } = await setup()
    const { data: row } = await u.sb.from('study_plan_days').insert({ plan_id: planId, day: '2026-10-12', sessions }).select('id').single()
    expect((await u.sb.from('study_plan_days').update({ sessions: { not: 'an array' } }).eq('id', row!.id)).error).not.toBeNull()
    const done = [{ ...sessions[0], done_at: '2026-10-12T10:00:00Z' }]
    expect((await u.sb.from('study_plan_days').update({ sessions: done }).eq('id', row!.id)).error).toBeNull()
    expect(((await u.sb.from('study_plan_days').select('sessions').eq('id', row!.id).single()).data!.sessions as { done_at: string }[])[0].done_at).toBe('2026-10-12T10:00:00Z')
  })
})
