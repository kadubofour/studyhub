// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, cleanup, within, fireEvent } from '@testing-library/react'
import type { Course } from '@/lib/types'
import type { LibraryItem } from '@/lib/library/items'

let courses: Course[] = []
let items: LibraryItem[] = []
let fails = false
let libraryFails = false
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
let createFails = false
const createCourse = vi.fn(async (_sb: unknown, c: { name: string; color: string }) => { if (createFails) throw new Error('offline'); return { id: 'new', ...c } })
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => { if (fails) throw new Error('offline'); return courses }, createCourse: (sb: unknown, c: { name: string; color: string }) => createCourse(sb, c) }))
vi.mock('@/lib/data/library', () => ({ loadLibrary: async () => { if (libraryFails) throw new Error('offline'); return items } }))
import CoursesPage from '@/app/(app)/courses/page'

const item = (kind: LibraryItem['kind'], id: string, course: string | null): LibraryItem => ({ kind, id, title: id, course_id: course, at: '', meta: '', href: '' })
const open = async () => { await act(async () => { render(<CoursesPage />) }) }
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  createCourse.mockClear(); createFails = false; courses = [{ id: 'bio', name: 'Biology', color: '#1D9E75' }, { id: 'lang', name: 'Spanish', color: '#BA7517' }]; items = []; fails = false; libraryFails = false })
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
  it('draws each course as a split card: the item count in a coloured block, the words beside it', async () => {
    items = [item('note', 'n1', 'bio'), item('note', 'n2', 'bio'), item('deck', 'd1', 'bio')]
    await open()
    const bio = within(screen.getByRole('list', { name: 'Your courses' })).getByRole('link', { name: /Biology/ })
    const block = bio.querySelector('[data-block]') as HTMLElement
    expect(block.textContent).toBe('3')
    expect((bio.style as CSSStyleDeclaration).getPropertyValue('--c')).toBe('#1D9E75')
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

describe('making a course from Courses', () => {
  const make = async (name: string) => {
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'New course' })) })
    const dialog = within(screen.getByRole('dialog', { name: 'New course' }))
    fireEvent.change(dialog.getByLabelText('Name'), { target: { value: name } })
    await act(async () => { fireEvent.click(dialog.getByRole('button', { name: 'Add course' })) })
  }
  it('is one click from the title, and the new course joins the list', async () => {
    await open()
    await make('Chemistry')
    expect(createCourse).toHaveBeenCalledWith({}, { name: 'Chemistry', color: expect.stringMatching(/^#/) })
    expect(within(screen.getByRole('list', { name: 'Your courses' })).getByRole('link', { name: /Chemistry/ })).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('can be made when there are none yet, right where the page says so', async () => {
    courses = []
    await open()
    await make('Chemistry')
    expect(screen.getByRole('list', { name: 'Your courses' })).toBeTruthy()
  })
  it('says so and keeps the dialog open when it cannot', async () => {
    createFails = true
    await open()
    await make('Chemistry')
    expect(within(screen.getByRole('dialog', { name: 'New course' })).getByRole('alert').textContent).toMatch(/Couldn.t add/)
  })
  it('does nothing without a name', async () => {
    await open()
    await make('  ')
    expect(createCourse).not.toHaveBeenCalled()
  })
})
