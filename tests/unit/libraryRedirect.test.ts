import { describe, it, expect, vi } from 'vitest'

const redirect = vi.fn((to: string) => { throw new Error(`redirect:${to}`) })
vi.mock('next/navigation', () => ({ redirect: (to: string) => redirect(to) }))
import LibraryPage from '@/app/(app)/library/page'
import { courseHref, notebookHomeHref } from '@/lib/course/home'

const go = async (q: { course?: string; view?: string }) => { try { await LibraryPage({ searchParams: Promise.resolve(q) }) } catch (e) { return (e as Error).message.replace('redirect:', '') } return '' }

describe('the old Library address', () => {
  it('opens All material as the Library opened', async () => {
    expect(await go({})).toBe('/courses?show=material')
    expect(await go({ view: 'all' })).toBe('/courses?show=material&view=all')
  })
  it('opens the course it names, or Unsorted', async () => {
    expect(await go({ course: 'none' })).toBe('/courses/none')
    expect(await go({ course: '11111111-1111-4111-8111-111111111111' })).toBe('/courses/11111111-1111-4111-8111-111111111111')
  })
  it('ignores a course that is not an id', async () => {
    expect(await go({ course: '../../x' })).toBe('/courses?show=material')
  })
})

describe('the page a thing\'s back button goes to', () => {
  it('its course, or Unsorted when it has none', () => {
    expect(courseHref('bio')).toBe('/courses/bio')
    expect(courseHref(null)).toBe('/courses/none')
    expect(courseHref(undefined)).toBe('/courses/none')
  })
  it('a notebook: the course chosen for it, else the one its notes share, else Unsorted', () => {
    const book = (course_id: string | null) => ({ id: 'b', name: 'B', course_id, created_at: '' })
    const notes = (...cs: (string | null)[]) => cs.map(course_id => ({ notebook_id: 'b', course_id }))
    expect(notebookHomeHref(book('chem'), notes('bio'))).toBe('/courses/chem')
    expect(notebookHomeHref(book(null), notes('bio', 'bio'))).toBe('/courses/bio')
    expect(notebookHomeHref(book(null), notes('bio', 'lang'))).toBe('/courses/none')
    expect(notebookHomeHref(book(null), notes())).toBe('/courses/none')
  })
})
