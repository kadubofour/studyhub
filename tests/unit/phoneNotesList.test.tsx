// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { PhoneNotesList } from '@/components/notes/PhoneNotesList'
import type { NoteSummary } from '@/lib/types'

afterEach(cleanup)
const today = new Date().toISOString()
const lastWeek = new Date(Date.now() - 3 * 86_400_000).toISOString()
const notes: NoteSummary[] = [
  { id: 'a', course_id: null, title: 'Krebs cycle', updated_at: today, preview: '## Where\nIn the **matrix**' },
  { id: 'b', course_id: null, title: '', updated_at: lastWeek, preview: '' },
]
const props = (over: Partial<React.ComponentProps<typeof PhoneNotesList>> = {}): React.ComponentProps<typeof PhoneNotesList> => ({
  notes, loaded: true, searching: false, q: '', onSearch: vi.fn(), books: [{ id: 'n1', name: 'Biology', count: 3, color: '#2b6cb0' }],
  courses: [], course: '', onCourse: vi.fn(), sort: 'edited', onSort: vi.fn(), selecting: false, selected: [], onToggle: vi.fn(),
  onStopSelecting: vi.fn(), selectionActions: null, onSelect: vi.fn(), onNewNotebook: vi.fn(), onUpload: vi.fn(), onCreate: vi.fn(), onMenu: vi.fn(), ...over,
})

describe('the notes list on a phone', () => {
  it('groups notes by when they were edited, each row with its title, date and first line', () => {
    render(<PhoneNotesList {...props()} />)
    const todayList = screen.getByRole('list', { name: 'Today' })
    const row = within(todayList).getByRole('link')
    expect(row.getAttribute('href')).toBe('/notes/a')
    expect(row.textContent).toContain('Krebs cycle')
    expect(row.textContent).toContain('Where') // the first line, without its Markdown
    const week = within(screen.getByRole('list', { name: 'Previous 7 days' })).getByRole('link')
    expect(week.textContent).toContain('Untitled')
    expect(week.textContent).toContain('No additional text')
    expect(screen.getByText('2 notes')).toBeTruthy()
  })
  it('shows the notebooks as folder rows with their counts', () => {
    render(<PhoneNotesList {...props()} />)
    const book = within(screen.getByRole('list', { name: 'Notebooks' })).getByRole('link')
    expect(book.getAttribute('href')).toBe('/notebooks/n1')
    expect(book.textContent).toContain('Biology3')
  })
  it('writes a new note from the button at the bottom right', () => {
    const p = props()
    render(<PhoneNotesList {...p} />)
    fireEvent.click(screen.getByRole('button', { name: 'New note' }))
    expect(p.onCreate).toHaveBeenCalledTimes(1)
  })
  it('in one list, not by date, when sorted another way or searching', () => {
    render(<PhoneNotesList {...props({ sort: 'title' })} />)
    expect(screen.queryByRole('list', { name: 'Today' })).toBeNull()
    expect(screen.getAllByRole('link').filter(l => l.getAttribute('href')?.startsWith('/notes/'))).toHaveLength(2)
  })
  it('while selecting, a tap ticks a note instead of opening it, and Done stops', () => {
    const p = props({ selecting: true, selected: ['a'] })
    render(<PhoneNotesList {...p} />)
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes.map(b => b.getAttribute('aria-checked'))).toEqual(['true', 'false'])
    fireEvent.click(boxes[1])
    expect(p.onToggle).toHaveBeenCalledWith('b')
    expect(screen.queryByRole('button', { name: 'New note' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(p.onStopSelecting).toHaveBeenCalledTimes(1)
  })
  it('keeps sorting, the course, selecting, a new notebook and upload in its ⋯ menu', () => {
    const p = props()
    render(<PhoneNotesList {...p} />)
    fireEvent.click(screen.getByRole('button', { name: 'Notes options' }))
    const menu = screen.getByRole('menu')
    for (const item of ['Select notes', 'New notebook', 'Upload', 'Recently edited', 'Title (A to Z)', 'All courses']) expect(within(menu).getByRole('menuitem', { name: item })).toBeTruthy()
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Title (A to Z)' }))
    expect(p.onSort).toHaveBeenCalledWith('title')
  })
})
