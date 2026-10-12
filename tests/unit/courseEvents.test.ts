// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { COURSES_CHANGED, TIMETABLE_CHANGED } from '@/lib/course/events'
import { createClass, deleteClass, updateClass } from '@/lib/data/classes'
import { createCourse, deleteCourse, updateCourse } from '@/lib/data/courses'

const heard = vi.fn()
beforeEach(() => { heard.mockClear(); window.addEventListener(COURSES_CHANGED, heard) })
afterEach(() => { window.removeEventListener(COURSES_CHANGED, heard) })

// A stand-in whose every query chain ends in `result`
function sb(result: unknown) {
  const q: Record<string, unknown> = {}
  for (const k of ['from', 'update', 'insert', 'delete', 'eq', 'select', 'single']) q[k] = () => q
  q.then = (res: (v: unknown) => unknown) => res(result)
  return q as never
}
const ok = { data: { id: 'c', name: 'Bio', color: '#000000' }, error: null }
const bad = { data: null, error: { message: 'x' } }

describe('the sidebar hears about course changes once they are saved', () => {
  it('a new course', async () => { await createCourse(sb(ok), { name: 'Bio', color: '#000000' }); expect(heard).toHaveBeenCalledTimes(1) })
  it('a renamed course', async () => { await updateCourse(sb(ok), 'c', { name: 'Biology' }); expect(heard).toHaveBeenCalledTimes(1) })
  it('a deleted course, once', async () => { await deleteCourse(sb(ok), 'c', { deleteContents: false }); expect(heard).toHaveBeenCalledTimes(1) })
  it('nothing when the save failed', async () => {
    await expect(createCourse(sb(bad), { name: 'Bio', color: '#000000' })).rejects.toBeTruthy()
    await expect(updateCourse(sb(bad), 'c', { name: 'x' })).rejects.toBeTruthy()
    await expect(deleteCourse(sb(bad), 'c', { deleteContents: false })).rejects.toBeTruthy()
    expect(heard).not.toHaveBeenCalled()
  })
})

describe('the top bar hears about timetable changes once they are saved', () => {
  const heardTimetable = vi.fn()
  beforeEach(() => { heardTimetable.mockClear(); window.addEventListener(TIMETABLE_CHANGED, heardTimetable) })
  afterEach(() => { window.removeEventListener(TIMETABLE_CHANGED, heardTimetable) })
  const slot = { course_id: 'c', day_of_week: 1, start_time: '09:00', end_time: '10:00', location: null, kind: 'lecture' as const }
  it('a new, changed or removed class', async () => {
    await createClass(sb(ok), slot); await updateClass(sb(ok), 'x', { location: 'B2' }); await deleteClass(sb(ok), 'x')
    expect(heardTimetable).toHaveBeenCalledTimes(3)
  })
  it('nothing when the save failed', async () => {
    await expect(createClass(sb(bad), slot)).rejects.toBeTruthy()
    await expect(updateClass(sb(bad), 'x', { location: 'B2' })).rejects.toBeTruthy()
    await expect(deleteClass(sb(bad), 'x')).rejects.toBeTruthy()
    expect(heardTimetable).not.toHaveBeenCalled()
  })
  it('a deleted course takes its classes with it, so that is announced too', async () => {
    await deleteCourse(sb(ok), 'c', { deleteContents: false })
    expect(heardTimetable).toHaveBeenCalledTimes(1)
  })
})
