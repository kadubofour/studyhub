import { describe, it, expect, beforeAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { newUser } from './helpers'
import { logFocusSession } from '@/lib/data/focus'

type U = { sb: SupabaseClient; id: string }
let A: U, B: U
beforeAll(async () => { A = await newUser(); B = await newUser() })
const at = (m: number) => new Date(Date.UTC(2026, 9, 1, 10, m))

describe('focus sessions linked to a task and a course', () => {
  it('keeps the task and course a session was spent on', async () => {
    const course = (await A.sb.from('courses').insert({ name: 'Bio', color: '#1D9E75' }).select('id').single()).data!
    const task = (await A.sb.from('tasks').insert({ title: 'Read chapter', course_id: course.id }).select('id').single()).data!
    await logFocusSession(A.sb, { startedAt: at(0), endedAt: at(25), minutes: 25, completed: true, taskId: task.id, courseId: course.id })
    const row = (await A.sb.from('focus_sessions').select('task_id,course_id,minutes').eq('started_at', at(0).toISOString()).single()).data!
    expect(row).toEqual({ task_id: task.id, course_id: course.id, minutes: 25 })
  })
  it('still logs a session with nothing attached', async () => {
    await logFocusSession(A.sb, { startedAt: at(40), endedAt: at(65), minutes: 25, completed: true })
    const row = (await A.sb.from('focus_sessions').select('task_id,course_id').eq('started_at', at(40).toISOString()).single()).data!
    expect(row).toEqual({ task_id: null, course_id: null })
  })
  it('cannot be linked to the task or course of another student: the database refuses the link, and the session is saved without it', async () => {
    const theirCourse = (await B.sb.from('courses').insert({ name: 'Theirs', color: '#1D9E75' }).select('id').single()).data!
    const theirTask = (await B.sb.from('tasks').insert({ title: 'Theirs' }).select('id').single()).data!
    // asked straight, the database says no
    const direct = await A.sb.from('focus_sessions').insert({ started_at: at(300).toISOString(), ended_at: at(325).toISOString(), minutes: 25, completed: true, task_id: theirTask.id })
    expect(direct.error).toBeTruthy()
    const directCourse = await A.sb.from('focus_sessions').insert({ started_at: at(300).toISOString(), ended_at: at(325).toISOString(), minutes: 25, completed: true, course_id: theirCourse.id })
    expect(directCourse.error).toBeTruthy()
    // the app still keeps the minutes, with no link to what does not belong to the student
    await logFocusSession(A.sb, { startedAt: at(90), endedAt: at(115), minutes: 25, completed: true, taskId: theirTask.id, courseId: theirCourse.id })
    const row = (await A.sb.from('focus_sessions').select('task_id,course_id,minutes').eq('started_at', at(90).toISOString()).single()).data!
    expect(row).toEqual({ task_id: null, course_id: null, minutes: 25 })
  })
  it('keeps the session when its task or course is deleted, with the link cleared', async () => {
    const course = (await A.sb.from('courses').insert({ name: 'Gone', color: '#1D9E75' }).select('id').single()).data!
    const task = (await A.sb.from('tasks').insert({ title: 'Gone' }).select('id').single()).data!
    await logFocusSession(A.sb, { startedAt: at(200), endedAt: at(225), minutes: 25, completed: true, taskId: task.id, courseId: course.id })
    await A.sb.from('tasks').delete().eq('id', task.id)
    await A.sb.from('courses').delete().eq('id', course.id)
    const row = (await A.sb.from('focus_sessions').select('task_id,course_id,minutes').eq('started_at', at(200).toISOString()).single()).data!
    expect(row).toEqual({ task_id: null, course_id: null, minutes: 25 })
  })
})
