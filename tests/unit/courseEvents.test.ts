// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { COURSES_CHANGED } from '@/lib/course/events'
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
