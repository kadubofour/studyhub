// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'

type Ai = { ok: true; value: unknown } | { ok: false; error: string; message: string }
const postAi = vi.fn<(url: string, body: object) => Promise<Ai>>()
vi.mock('@/components/ai/aiFetch', () => ({ postAi: (u: string, b: object) => postAi(u, b) }))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
const createCourse = vi.fn(async (_sb: unknown, i: { name: string; color: string }) => ({ id: `id-${i.name}`, ...i }))
vi.mock('@/lib/data/courses', () => ({ createCourse: (sb: unknown, i: { name: string; color: string }) => createCourse(sb, i) }))
const saveStarterMaterial = vi.fn(async (..._a: unknown[]) => 3)
vi.mock('@/lib/setup/starter', () => ({ saveStarterMaterial: (...a: unknown[]) => saveStarterMaterial(...a) }))
import { ProgrammeSetup } from '@/components/setup/ProgrammeSetup'

const about = { school: 'UG', programme: 'BSc Biology', year: 'Year 1' }
const onDone = vi.fn()
const topics = [{ name: 'The cell', note_md: 'x' }]
const open = async (existing: string[] = []) => { await act(async () => { render(<ProgrammeSetup about={about} existing={existing} onDone={onDone} />) }) }
const COURSES = '/api/ai/programme-courses', MATERIAL = '/api/ai/starter-material'
beforeEach(() => {
  postAi.mockReset(); createCourse.mockClear(); saveStarterMaterial.mockClear(); onDone.mockClear()
  postAi.mockImplementation(async url => url === COURSES
    ? { ok: true, value: { courses: ['Cell Biology', 'Genetics', 'Ecology'] } }
    : { ok: true, value: { topics } })
})
afterEach(cleanup)
const go = async (name: RegExp) => { await act(async () => { fireEvent.click(screen.getByRole('button', { name })) }) }

describe('ProgrammeSetup', () => {
  it('suggests the programme\'s courses, all ticked, leaving out ones the student already has', async () => {
    await open(['genetics'])
    expect(postAi).toHaveBeenCalledTimes(1)
    expect(postAi.mock.calls[0][1]).toMatchObject({ programme: 'BSc Biology', school: 'UG', year: 'Year 1' })
    const list = within(screen.getByRole('list', { name: 'Suggested courses' }))
    expect(list.getAllByRole('checkbox').map(c => (c as HTMLInputElement).checked)).toEqual([true, true])
    expect(list.queryByText('Genetics')).toBeNull()
    expect(screen.getByRole('button', { name: 'Add 2 courses' })).toBeTruthy()
  })
  it('adds the ticked courses, then drafts starter topics and notes for each, and says so', async () => {
    await open()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ecology' })) // untick
    await go(/Add 2 courses/)
    expect(createCourse.mock.calls.map(c => c[1].name)).toEqual(['Cell Biology', 'Genetics'])
    expect(postAi.mock.calls.filter(c => c[0] === MATERIAL).map(c => (c[1] as { course: string }).course)).toEqual(['Cell Biology', 'Genetics'])
    expect(saveStarterMaterial).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('heading', { name: '2 courses added' })).toBeTruthy()
    expect(screen.getAllByText('3 topics with notes')).toHaveLength(2)
    expect(screen.getByText(/drafts written by the AI/)).toBeTruthy()
    await go(/^Continue$/)
    expect(onDone).toHaveBeenCalledWith(2)
  })
  it('adds only the courses when the AI switch is off', async () => {
    await open()
    fireEvent.click(screen.getByRole('switch', { name: /Write starter notes/ }))
    await go(/Add 3 courses/)
    expect(createCourse).toHaveBeenCalledTimes(3)
    expect(postAi.mock.calls.some(c => c[0] === MATERIAL)).toBe(false)
  })
  it('takes a course of the student\'s own, once', async () => {
    await open()
    const box = screen.getByLabelText('Add a course')
    for (let i = 0; i < 2; i++) { fireEvent.change(box, { target: { value: 'Biostatistics' } }); fireEvent.submit(box.closest('form')!) }
    expect(screen.getAllByRole('checkbox', { name: 'Biostatistics' })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Add 4 courses' })).toBeTruthy()
  })
  it('stops asking the AI once the daily limit is reached, but still adds every course', async () => {
    postAi.mockImplementation(async url => url === COURSES
      ? { ok: true, value: { courses: ['Cell Biology', 'Genetics', 'Ecology'] } }
      : { ok: false, error: 'daily_limit', message: "You've used today's free AI actions." })
    await open()
    await go(/Add 3 courses/)
    expect(postAi.mock.calls.filter(c => c[0] === MATERIAL)).toHaveLength(1)
    expect(createCourse).toHaveBeenCalledTimes(3)
    expect(screen.getAllByText("You've used today's free AI actions.")).toHaveLength(1)
    expect(screen.getByRole('heading', { name: '3 courses added' })).toBeTruthy()
  })
  it('lets the student add courses themselves when the suggestions cannot be made', async () => {
    postAi.mockResolvedValueOnce({ ok: false, error: 'busy', message: "Couldn't reach the AI. Try again." })
    await open()
    expect(screen.getByRole('alert').textContent).toMatch(/Couldn't reach the AI/)
    expect(screen.getByRole('button', { name: 'Choose a course' }).hasAttribute('disabled')).toBe(true)
    fireEvent.change(screen.getByLabelText('Add a course'), { target: { value: 'Physics' } })
    fireEvent.submit(screen.getByLabelText('Add a course').closest('form')!)
    expect(screen.getByRole('button', { name: 'Add 1 course' })).toBeTruthy()
  })
  it('skips without adding anything', async () => {
    await open()
    await go(/^Skip$/)
    expect(onDone).toHaveBeenCalledWith(0)
    expect(createCourse).not.toHaveBeenCalled()
  })
})
