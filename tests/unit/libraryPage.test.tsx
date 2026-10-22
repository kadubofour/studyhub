// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'
import type { Course } from '@/lib/types'
import type { LibraryItem } from '@/lib/library/items'

const courses: Course[] = [{ id: 'bio', name: 'Biology', color: '#1D9E75' }, { id: 'lang', name: 'Spanish', color: '#BA7517' }]
const item = (kind: LibraryItem['kind'], id: string, title: string, course: string | null, at: string, meta = ''): LibraryItem =>
  ({ kind, id, title, course_id: course, at, meta, href: `/${kind}/${id}` })
const STUFF = [
  item('note', 'n1', 'Krebs cycle', 'bio', '2026-10-10T10:00:00Z'),
  item('note', 'n2', 'Loose thoughts', null, '2026-10-11T10:00:00Z'),
  item('deck', 'd1', 'Cells', 'bio', '2026-10-09T10:00:00Z', '12 cards · 3 due'),
  item('deck', 'd2', 'Spanish verbs', 'lang', '2026-10-08T10:00:00Z', '40 cards'),
  item('lecture', 'l1', 'Week 3 lecture', 'bio', '2026-10-07T10:00:00Z', '45 min'),
  item('quiz', 'q1', 'Krebs quiz', 'bio', '2026-10-10T12:00:00Z'),
  item('chat', 'c1', 'Why the matrix?', null, '2026-10-06T10:00:00Z'),
]
let items: LibraryItem[]
let loadFails = false
let search = ''
const requestUpload = vi.fn()
let movedCount: number | null = null
const moveItems = vi.fn(async (_sb: unknown, picked: unknown[], _course: unknown) => movedCount ?? picked.length)
const loadLibrary = vi.fn(async () => { if (loadFails) throw new Error('offline'); return items })
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(search), useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => courses, createCourse: vi.fn(), updateCourse: vi.fn(), deleteCourse: vi.fn() }))
vi.mock('@/lib/data/library', () => ({ loadLibrary: () => loadLibrary(), moveItems: (sb: unknown, p: unknown[], c: unknown) => moveItems(sb, p, c) }))
vi.mock('@/lib/scan/events', () => ({ requestUpload: () => requestUpload() }))
let notebooks: { id: string; name: string; created_at: string }[] = []
let notebooksFail = false
const createNotebook = vi.fn(async (_sb: unknown, name: string) => { const b = { id: 'new', name, created_at: '' }; notebooks = [...notebooks, b]; return b })
const renameNotebook = vi.fn(async (_sb: unknown, id: string, name: string) => { notebooks = notebooks.map(b => (b.id === id ? { ...b, name } : b)) })
const deleteNotebook = vi.fn(async (_sb: unknown, id: string) => { notebooks = notebooks.filter(b => b.id !== id) })
const moveNotes = vi.fn(async (..._a: unknown[]) => {})
vi.mock('@/lib/data/notebooks', () => ({
  listNotebooks: async () => { if (notebooksFail) throw new Error('offline'); return notebooks },
  createNotebook: (sb: unknown, n: string) => createNotebook(sb, n), renameNotebook: (sb: unknown, id: string, n: string) => renameNotebook(sb, id, n),
  deleteNotebook: (sb: unknown, id: string) => deleteNotebook(sb, id), moveNotes: (...a: unknown[]) => moveNotes(...a),
}))
import LibraryPage from '@/app/(app)/library/page'
import { ToastProvider } from '@/components/providers/ToastProvider'
import { ConfirmProvider } from '@/components/providers/ConfirmProvider'

const open = async () => { await act(async () => { render(<ToastProvider><ConfirmProvider><LibraryPage /></ConfirmProvider></ToastProvider>) }) }
const rows = () => screen.getAllByRole('listitem').map(li => li.textContent ?? '')
const click = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el) }) }
beforeEach(() => { notebooks = []; notebooksFail = false; createNotebook.mockClear(); renameNotebook.mockClear(); deleteNotebook.mockClear(); moveNotes.mockClear(); movedCount = null; items = STUFF; loadFails = false; search = ''; requestUpload.mockClear(); moveItems.mockClear(); loadLibrary.mockClear() })
afterEach(cleanup)
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})

describe('Library', () => {
  it('lists everything, newest first, with what it is and where it belongs', async () => {
    await open()
    const r = rows()
    expect(r).toHaveLength(7)
    expect(r[0]).toContain('Loose thoughts')
    expect(r[1]).toContain('Krebs quiz')
    expect(r.find(t => t.includes('Cells'))).toContain('12 cards · 3 due')
    expect(r.find(t => t.includes('Cells'))).toContain('Biology')
    expect(screen.getByText('7 items')).toBeTruthy()
  })
  it('links each item to its page', async () => {
    await open()
    expect(screen.getByRole('link', { name: /Krebs cycle/ }).getAttribute('href')).toBe('/note/n1')
    expect(screen.getByRole('link', { name: /Week 3 lecture/ }).getAttribute('href')).toBe('/lecture/l1')
  })

  describe('finding things', () => {
    it('filters by kind, and the chips say how many each holds', async () => {
      await open()
      const chip = screen.getByRole('button', { name: /^Decks 2$/ })
      expect(chip.getAttribute('aria-pressed')).toBe('false')
      await click(chip)
      expect(chip.getAttribute('aria-pressed')).toBe('true')
      expect(rows()).toHaveLength(2)
      await click(chip) // again to clear
      expect(rows()).toHaveLength(7)
    })
    it('filters by course, and by none', async () => {
      await open()
      await click(screen.getByRole('button', { name: 'Spanish' }))
      expect(rows()).toHaveLength(1)
      await click(screen.getByRole('button', { name: 'Unsorted' }))
      expect(screen.getByRole('button', { name: 'Unsorted' }).getAttribute('aria-pressed')).toBe('true')
      expect(rows().map(t => t.includes('Loose thoughts') || t.includes('Why the matrix'))).toEqual([true, true])
      await click(screen.getByRole('button', { name: 'All' }))
      expect(rows()).toHaveLength(7)
    })
    it('has quick ways to start a note or a deck', async () => {
      await open()
      expect(screen.getByRole('button', { name: 'New note' })).toBeTruthy()
      expect(screen.getByRole('link', { name: 'New deck' }).getAttribute('href')).toBe('/flashcards?new=1')
    })
    it('opens on a course named in the address', async () => {
      search = 'course=bio'
      await open()
      expect(rows()).toHaveLength(4)
    })
    it('shows everything when the address names a course that no longer exists', async () => {
      search = 'course=deleted-long-ago'
      await open()
      expect(rows()).toHaveLength(7)
      expect(screen.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('true')
    })
    it('links to the course page once a course is chosen', async () => {
      search = 'course=bio'
      await open()
      expect(screen.getByRole('link', { name: 'Open course page' }).getAttribute('href')).toBe('/courses/bio')
    })
    it('has no course page link for All or Unsorted', async () => {
      await open()
      expect(screen.queryByRole('link', { name: 'Open course page' })).toBeNull()
      await click(screen.getByRole('button', { name: /Unsorted/ }))
      expect(screen.queryByRole('link', { name: 'Open course page' })).toBeNull()
    })
    it('opens on Unsorted when the address says none', async () => {
      search = 'course=none'
      await open()
      expect(rows()).toHaveLength(2)
    })
    it('searches titles', async () => {
      await open()
      fireEvent.change(screen.getByLabelText('Search the library'), { target: { value: 'krebs' } })
      expect(rows()).toHaveLength(2)
    })
    it('says nothing matches, and clears the filters', async () => {
      await open()
      fireEvent.change(screen.getByLabelText('Search the library'), { target: { value: 'zzz' } })
      expect(screen.getByText('Nothing matches.')).toBeTruthy()
      await click(screen.getByRole('button', { name: 'Clear filters' }))
      expect(rows()).toHaveLength(7)
    })
    it('sorts by name', async () => {
      await open()
      await click(screen.getByRole('radio', { name: 'Name' }))
      expect(rows()[0]).toContain('Cells')
    })
  })

  describe('moving', () => {
    const pick = async (title: RegExp) => { await click(screen.getByRole('checkbox', { name: title })) }
    it('moves the ticked items to a course, then reads the list again', async () => {
      await open()
      await pick(/Loose thoughts/); await pick(/Why the matrix/)
      expect(screen.getByText('2 selected')).toBeTruthy()
      await click(within(screen.getByRole('radiogroup', { name: 'Move to' })).getByRole('radio', { name: 'Biology' }))
      await click(screen.getByRole('button', { name: 'Move' }))
      expect(moveItems).toHaveBeenCalledWith({}, [{ kind: 'note', id: 'n2' }, { kind: 'chat', id: 'c1' }], 'bio')
      expect(loadLibrary).toHaveBeenCalledTimes(2)
      expect(screen.getByText('Moved 2 items.')).toBeTruthy()
      expect(screen.getAllByRole('status').some(s => s.textContent === '2 items selected')).toBe(false)
      expect(screen.queryByText('2 items selected')).toBeNull()
      expect(screen.queryByText('2 selected')).toBeNull()
    })
    it('can move items out of any course', async () => {
      await open()
      await pick(/Krebs cycle/)
      await click(within(screen.getByRole('radiogroup', { name: 'Move to' })).getByRole('radio', { name: 'Unsorted' }))
      await click(screen.getByRole('button', { name: 'Move' }))
      expect(moveItems).toHaveBeenCalledWith({}, [{ kind: 'note', id: 'n1' }], null)
    })
    it('moves only what is shown: ticked items hidden by a filter stay where they are', async () => {
      await open()
      await click(screen.getByRole('button', { name: 'Unsorted' }))
      await pick(/Loose thoughts/); await pick(/Why the matrix/)
      await click(screen.getByRole('button', { name: 'Spanish' }))
      await click(screen.getByRole('checkbox', { name: 'Select all shown' }))
      expect(screen.getByText('1 selected')).toBeTruthy()
      await click(within(screen.getByRole('radiogroup', { name: 'Move to' })).getByRole('radio', { name: 'Biology' }))
      await click(screen.getByRole('button', { name: 'Move' }))
      expect(moveItems).toHaveBeenCalledWith({}, [{ kind: 'deck', id: 'd2' }], 'bio')
    })
    it('says so when only some of the items could be moved', async () => {
      movedCount = 1
      await open()
      await pick(/Loose thoughts/); await pick(/Why the matrix/)
      await click(within(screen.getByRole('radiogroup', { name: 'Move to' })).getByRole('radio', { name: 'Biology' }))
      await click(screen.getByRole('button', { name: 'Move' }))
      expect(screen.getByText('Moved 1 of 2 items. The others had changed.')).toBeTruthy()
    })
    it('says nothing was moved when none could be', async () => {
      movedCount = 0
      await open()
      await pick(/Loose thoughts/)
      await click(within(screen.getByRole('radiogroup', { name: 'Move to' })).getByRole('radio', { name: 'Biology' }))
      await click(screen.getByRole('button', { name: 'Move' }))
      expect(screen.getByText('Nothing was moved. Those items had changed.')).toBeTruthy()
    })
    it('does not let a quiz be ticked, and says why', async () => {
      await open()
      const box = screen.getByRole('checkbox', { name: /Krebs quiz/ }) as HTMLInputElement
      expect(box.disabled).toBe(true)
      expect(screen.getByText(/Quizzes stay with their note/)).toBeTruthy()
    })
    it('selects every visible item that can move', async () => {
      await open()
      await click(screen.getByRole('checkbox', { name: 'Select all shown' }))
      expect(screen.getByText('6 selected')).toBeTruthy() // seven items, one a quiz
    })
    it('offers nothing to move to until something is ticked', async () => {
      await open()
      expect(screen.queryByRole('radiogroup', { name: 'Move to' })).toBeNull()
    })
    it('says it could not move, and reads the list again, when the move is refused', async () => {
      moveItems.mockRejectedValueOnce(new Error('refused'))
      await open()
      await pick(/Krebs cycle/)
      await click(within(screen.getByRole('radiogroup', { name: 'Move to' })).getByRole('radio', { name: 'Spanish' }))
      await click(screen.getByRole('button', { name: 'Move' }))
      expect(screen.getByText('Could not move those items.')).toBeTruthy()
      expect(loadLibrary).toHaveBeenCalledTimes(2)
    })
    it('drops a ticked item that is no longer in the list after a refresh', async () => {
      await open()
      await pick(/Krebs cycle/)
      items = STUFF.filter(i => i.id !== 'n1')
      await click(within(screen.getByRole('radiogroup', { name: 'Move to' })).getByRole('radio', { name: 'Spanish' }))
      await click(screen.getByRole('button', { name: 'Move' }))
      expect(screen.queryByText(/selected/)).toBeNull()
    })
  })

  describe('empty and broken', () => {
    it('invites a new student to bring material in', async () => {
      items = []
      await open()
      expect(screen.getByRole('heading', { name: 'Your library starts here' })).toBeTruthy()
      await click(screen.getByRole('button', { name: 'Upload' }))
      expect(requestUpload).toHaveBeenCalledTimes(1)
    })
    it('says it could not load, and tries again', async () => {
      loadFails = true
      await open()
      expect(screen.getByRole('alert').textContent).toContain('Could not load your library')
      loadFails = false
      await click(screen.getByRole('button', { name: 'Try again' }))
      expect(rows()).toHaveLength(7)
    })
    it('lists an empty course as empty, not as nothing matching', async () => {
      items = STUFF.filter(i => i.course_id !== 'lang')
      search = 'course=lang'
      await open()
      expect(screen.getByText('Nothing in this course yet.')).toBeTruthy()
    })
  })

  it('has the page title and lists courses as filters', async () => {
    await open()
    expect(screen.getByRole('heading', { level: 1, name: 'Library' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Biology' }).getAttribute('aria-pressed')).toBe('false')
    const chips = screen.getByRole('group', { name: 'Courses' })
    expect(within(chips).getByRole('button', { name: 'Biology' })).toBeTruthy()
  })

  describe('notebooks are folders', () => {
    const FILED = [
      ...STUFF,
      { ...item('note', 'n3', 'Glycolysis', 'bio', '2026-10-12T10:00:00Z'), notebook_id: 'cell' },
      { ...item('note', 'n4', 'Mitochondria', 'bio', '2026-10-01T10:00:00Z'), notebook_id: 'cell' },
    ]
    const shelf = () => within(screen.getByRole('list', { name: 'Notebooks' }))
    const listed = () => within(screen.getByRole('list', { name: 'Library items' })).getAllByRole('listitem').map(li => li.textContent ?? '')
    beforeEach(() => { items = FILED; notebooks = [{ id: 'cell', name: 'Cell biology', created_at: '' }, { id: 'old', name: 'Archive', created_at: '' }] })

    it('shows each notebook as a folder with its note count, and keeps filed notes inside it', async () => {
      await open()
      expect(shelf().getAllByRole('button').map(b => b.getAttribute('aria-label'))).toEqual(['Open Archive, 0 notes', 'Open Cell biology, 2 notes'])
      expect(listed().some(t => t.includes('Glycolysis'))).toBe(false)
      expect(listed()).toHaveLength(7)
    })
    it('opens a folder: its notes, and a way back to the whole Library', async () => {
      await open()
      await click(shelf().getByRole('button', { name: /Cell biology/ }))
      const trail = within(screen.getByRole('navigation', { name: 'Breadcrumb' }))
      expect(trail.getByText('Cell biology').getAttribute('aria-current')).toBe('page')
      expect(listed().map(t => t.includes('Glycolysis') || t.includes('Mitochondria'))).toEqual([true, true])
      expect(screen.queryByRole('list', { name: 'Notebooks' })).toBeNull()
      await click(trail.getByRole('button', { name: 'Library' }))
      expect(screen.getByRole('list', { name: 'Notebooks' })).toBeTruthy()
      expect(listed()).toHaveLength(7)
    })
    it('keeps the open folder in the address, so coming back from a note opens it again', async () => {
      const replace = vi.spyOn(window.history, 'replaceState')
      await open()
      await click(shelf().getByRole('button', { name: /Cell biology/ }))
      expect(String(replace.mock.calls.at(-1)![2])).toMatch(/[?&]notebook=cell/)
      await click(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole('button', { name: 'Library' }))
      expect(String(replace.mock.calls.at(-1)![2])).not.toContain('notebook=')
      cleanup()
      search = 'notebook=cell'
      await open()
      expect(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByText('Cell biology')).toBeTruthy()
      replace.mockRestore()
    })
    it('says so when a folder is empty', async () => {
      await open()
      await click(shelf().getByRole('button', { name: /Archive/ }))
      expect(screen.getByText('No notes in this notebook yet.')).toBeTruthy()
    })
    it('finds notes inside folders when searching, and says which notebook each is in', async () => {
      await open()
      fireEvent.change(screen.getByLabelText('Search the library'), { target: { value: 'glyco' } })
      expect(screen.queryByRole('list', { name: 'Notebooks' })).toBeNull()
      expect(listed()).toHaveLength(1)
      expect(listed()[0]).toContain('Cell biology')
    })
    it('makes a new notebook from the Library', async () => {
      await open()
      await click(screen.getByRole('button', { name: 'New notebook' }))
      const dialog = within(screen.getByRole('dialog', { name: 'New notebook' }))
      fireEvent.change(dialog.getByLabelText('Name'), { target: { value: 'Genetics' } })
      await click(dialog.getByRole('button', { name: 'Create' }))
      expect(createNotebook).toHaveBeenCalledWith({}, 'Genetics')
      expect(shelf().getByRole('button', { name: 'Open Genetics, 0 notes' })).toBeTruthy()
    })
    it('renames and deletes the open notebook; deleting keeps its notes, loose again', async () => {
      await open()
      await click(shelf().getByRole('button', { name: /Cell biology/ }))
      await click(screen.getByRole('button', { name: 'Rename notebook' }))
      const dialog = within(screen.getByRole('dialog', { name: 'Rename notebook' }))
      fireEvent.change(dialog.getByLabelText('Name'), { target: { value: 'Cells' } })
      await click(dialog.getByRole('button', { name: 'Save' }))
      expect(renameNotebook).toHaveBeenCalledWith({}, 'cell', 'Cells')
      expect(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByText('Cells')).toBeTruthy()
      await click(screen.getByRole('button', { name: 'Delete notebook' }))
      await click(screen.getByRole('button', { name: 'Delete' }))
      expect(deleteNotebook).toHaveBeenCalledWith({}, 'cell')
      expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull()
      expect(loadLibrary).toHaveBeenCalledTimes(2)
      expect(listed().some(t => t.includes('Glycolysis'))).toBe(true) // its notes are loose again
    })
    it('moves ticked notes into a notebook', async () => {
      await open()
      await click(screen.getByRole('checkbox', { name: /Loose thoughts/ }))
      await click(screen.getByRole('checkbox', { name: /Krebs cycle/ }))
      await click(screen.getByRole('button', { name: 'Move to notebook' }))
      await click(within(screen.getByRole('dialog', { name: 'Move to notebook' })).getByRole('button', { name: 'Cell biology' }))
      expect(moveNotes).toHaveBeenCalledWith({}, ['n2', 'n1'], 'cell')
      expect(screen.getByText('Moved 2 notes to Cell biology.')).toBeTruthy()
      expect(loadLibrary).toHaveBeenCalledTimes(2)
    })
    it('offers Move to notebook only when every ticked item is a note', async () => {
      await open()
      await click(screen.getByRole('checkbox', { name: /Loose thoughts/ }))
      expect(screen.getByRole('button', { name: 'Move to notebook' })).toBeTruthy()
      await click(screen.getByRole('checkbox', { name: /Cells/ }))
      expect(screen.queryByRole('button', { name: 'Move to notebook' })).toBeNull()
    })
    it('reads the notebooks again with the items, so a notebook made elsewhere shows its notes', async () => {
      await open()
      notebooks = [...notebooks, { id: 'gen', name: 'Genetics', created_at: '' }]
      items = [...FILED, { ...item('note', 'n5', 'Mendel', 'bio', '2026-10-02T10:00:00Z'), notebook_id: 'gen' }]
      await click(screen.getByRole('checkbox', { name: /Loose thoughts/ }))
      await click(within(screen.getByRole('radiogroup', { name: 'Move to' })).getByRole('radio', { name: 'Biology' }))
      await click(screen.getByRole('button', { name: 'Move' }))
      expect(shelf().getByRole('button', { name: 'Open Genetics, 1 note' })).toBeTruthy()
    })
    it('a note in a notebook it cannot find stays in view, loose', async () => {
      notebooks = []
      await open()
      expect(screen.queryByRole('list', { name: 'Notebooks' })).toBeNull()
      expect(listed().some(t => t.includes('Glycolysis'))).toBe(true)
    })
    it('says it could not load when the notebooks cannot be read, rather than hiding notes', async () => {
      notebooksFail = true
      await open()
      expect(screen.getByRole('alert').textContent).toContain('Could not load your library')
    })
    it('keeps the chosen course in the address, so coming back keeps it', async () => {
      const replace = vi.spyOn(window.history, 'replaceState')
      search = 'course=bio'
      await open()
      await click(screen.getByRole('button', { name: 'All' }))
      expect(String(replace.mock.calls.at(-1)![2])).not.toContain('course=')
      await click(screen.getByRole('button', { name: 'Spanish' }))
      expect(String(replace.mock.calls.at(-1)![2])).toContain('course=lang')
      replace.mockRestore()
    })
    it('inside a folder with a course chosen, says the folder has nothing from that course, and offers all courses', async () => {
      await open()
      await click(shelf().getByRole('button', { name: /Cell biology/ }))
      await click(screen.getByRole('button', { name: 'Spanish' }))
      expect(screen.getByText('No notes from Spanish in Cell biology.')).toBeTruthy()
      await click(screen.getByRole('button', { name: 'Show all courses' }))
      expect(listed()).toHaveLength(2)
    })
    it('does not say nothing matches when the course\'s notes are all in folders', async () => {
      items = FILED.filter(i => i.course_id === 'bio' && i.kind === 'note' && i.notebook_id)
      search = 'course=bio'
      await open()
      expect(shelf().getByRole('button', { name: /Cell biology/ })).toBeTruthy()
      expect(screen.queryByText('Nothing matches.')).toBeNull()
    })
    it('shows only the folders with notes in the chosen course', async () => {
      search = 'course=lang'
      items = FILED.filter(i => i.course_id === 'lang')
      await open()
      expect(screen.queryByRole('list', { name: 'Notebooks' })).toBeNull()
    })
  })
})
