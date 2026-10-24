// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import { CourseAccess } from '@/components/home/CourseAccess'
import type { Recent } from '@/lib/home/material'
import type { Course } from '@/lib/types'

afterEach(cleanup)
const courses: Course[] = [{ id: 'bio', name: 'Biology', color: '#1D9E75' }, { id: 'chem', name: 'Chemistry', color: '#BA7517' }]
const counts = { bio: { notes: 2, decks: 1, lectures: 0 } }
const recent: Recent[] = [
  { kind: 'note', id: 'n2', title: 'Krebs cycle', course_id: 'bio', at: '2026-10-12T10:00:00Z', href: '/notes/n2' },
  { kind: 'deck', id: 'd2', title: 'Bonding', course_id: 'chem', at: '2026-10-11T10:00:00Z', href: '/flashcards/d2' },
]

describe('CourseAccess', () => {
  it('has a card for each course that opens its page, with what is in it', () => {
    render(<CourseAccess courses={courses} counts={counts} recent={recent} />)
    const list = screen.getByRole('list', { name: 'Your courses' })
    const bio = within(list).getByRole('link', { name: /Biology/ })
    expect(bio.getAttribute('href')).toBe('/courses/bio')
    expect(bio.textContent).toContain('2 notes · 1 deck')
    expect(within(list).getByRole('link', { name: /Chemistry/ }).textContent).toContain('Nothing here yet')
  })
  it('lists the newest material to jump back into, with its course', () => {
    render(<CourseAccess courses={courses} counts={counts} recent={recent} />)
    const list = screen.getByRole('list', { name: 'Jump back in' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByRole('link', { name: /Krebs cycle/ }).getAttribute('href')).toBe('/notes/n2')
    expect(items[0].textContent).toContain('Biology')
    expect(within(items[1]).getByRole('link', { name: /Bonding/ }).getAttribute('href')).toBe('/flashcards/d2')
  })
  it('shows the courses alone when there is no material yet', () => {
    render(<CourseAccess courses={courses} counts={{}} recent={[]} />)
    expect(screen.getByRole('list', { name: 'Your courses' })).toBeTruthy()
    expect(screen.queryByRole('list', { name: 'Jump back in' })).toBeNull()
  })
  it('says nothing at all when there are no courses', () => {
    const { container } = render(<CourseAccess courses={[]} counts={{}} recent={[]} />)
    expect(container.firstElementChild).toBeNull()
  })
})

describe('Jump back in looks like the rest', () => {
  it('each item is a tile, so it takes the card style of the look', () => {
    render(<CourseAccess courses={courses} counts={counts} recent={recent} />)
    for (const li of within(screen.getByRole('list', { name: 'Jump back in' })).getAllByRole('listitem')) expect(li.className).toContain('tile')
  })
})
