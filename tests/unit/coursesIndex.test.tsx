// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, cleanup, within } from '@testing-library/react'
import type { Course } from '@/lib/types'
import type { LibraryItem } from '@/lib/library/items'

let courses: Course[] = []
let items: LibraryItem[] = []
let fails = false
let libraryFails = false
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => { if (fails) throw new Error('offline'); return courses } }))
vi.mock('@/lib/data/library', () => ({ loadLibrary: async () => { if (libraryFails) throw new Error('offline'); return items } }))
import CoursesPage from '@/app/(app)/courses/page'

const item = (kind: LibraryItem['kind'], id: string, course: string | null): LibraryItem => ({ kind, id, title: id, course_id: course, at: '', meta: '', href: '' })
const open = async () => { await act(async () => { render(<CoursesPage />) }) }
beforeEach(() => { courses = [{ id: 'bio', name: 'Biology', color: '#1D9E75' }, { id: 'lang', name: 'Spanish', color: '#BA7517' }]; items = []; fails = false; libraryFails = false })
afterEach(cleanup)

describe('Courses', () => {
  it('lists every course as a link to its page, with what is in it', async () => {
    items = [item('note', 'n1', 'bio'), item('note', 'n2', 'bio'), item('deck', 'd1', 'bio')]
    await open()
    const list = screen.getByRole('list', { name: 'Your courses' })
    const bio = within(list).getByRole('link', { name: /Biology/ })
    expect(bio.getAttribute('href')).toBe('/courses/bio')
    expect(bio.textContent).toContain('2 notes · 1 deck')
    expect(within(list).getByRole('link', { name: /Spanish/ }).textContent).toContain('Nothing here yet')
  })
  it('invites the student to make a course when there are none', async () => {
    courses = []
    await open()
    expect(screen.getByRole('heading', { name: 'No courses yet' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open the Planner' }).getAttribute('href')).toBe('/planner')
  })
  it('says when the courses could not load', async () => {
    fails = true
    await open()
    expect(screen.getByRole('alert').textContent).toMatch(/Could not load/)
  })
  it('still lists the courses when their contents could not be counted', async () => {
    libraryFails = true
    await open()
    const list = screen.getByRole('list', { name: 'Your courses' })
    expect(within(list).getAllByRole('link')).toHaveLength(2)
  })
})
