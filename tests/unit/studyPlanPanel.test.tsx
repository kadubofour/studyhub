// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'
import type { PlanView } from '@/lib/plan/load'
import type { Course, Task } from '@/lib/types'

const setDone = vi.fn(), reload = vi.fn(), start = vi.fn()
let views: PlanView[] | null
let failed = false
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/components/plan/usePlans', () => ({ usePlans: () => ({ views, failed, reload, setDone }) }))
vi.mock('@/components/plan/useWarmup', () => ({ useWarmup: () => ({ busy: null, error: null, start }) }))
const savePlan = vi.fn(async (..._a: unknown[]) => {}), deletePlan = vi.fn(async (..._a: unknown[]) => {})
vi.mock('@/lib/plan/service', () => ({ savePlan: (...a: unknown[]) => savePlan(...a), deletePlan: (...a: unknown[]) => deletePlan(...a) }))
import { StudyPlanPanel } from '@/components/plan/StudyPlanPanel'
import { ConfirmProvider } from '@/components/providers/ConfirmProvider'

const courses: Course[] = [{ id: 'c1', name: 'Biology', color: '#1D9E75' }, { id: 'c2', name: 'Chemistry', color: '#BA7517' }]
const exam = (over: Partial<Task> = {}): Task => ({ id: 'e1', course_id: 'c1', title: 'Midterm', type: 'exam', due_at: new Date(Date.now() + 14 * 86_400_000).toISOString(), priority: 'normal', done_at: null, created_at: '', ...over })
const view = (over: Partial<PlanView> = {}): PlanView => ({
  plan: { id: 'p1', course_id: 'c1', exam_task_id: 'e1', mode: 'balanced', minutes_per_day: 45, days_off: [], exam: { id: 'e1', title: 'Midterm', due_at: '2026-10-26T00:00:00Z', done_at: null } },
  courseId: 'c1', examDay: '2026-10-26', daysToExam: 14, status: 'ok', todayDayId: 'day1',
  today: [{ id: 's1', topic_id: 't1', kind: 'learn', minutes: 25, done_at: null, topicName: 'Krebs cycle', noteId: 'n1' }, { id: 's2', topic_id: 't2', kind: 'warmup', minutes: 10, done_at: null, topicName: 'Glycolysis', noteId: 'n2' }],
  upcoming: [{ day: '2026-10-13', sessions: [{ topicId: 't2', kind: 'learn', minutes: 25, topicName: 'Glycolysis', noteId: 'n2' }] }],
  schedule: [
    { day: '2026-10-13', sessions: [{ topicId: 't2', kind: 'learn', minutes: 25, topicName: 'Glycolysis', noteId: 'n2' }] },
    { day: '2026-10-25', sessions: [{ topicId: 't1', kind: 'revise', minutes: 15, topicName: 'Krebs cycle', noteId: 'n1' }] },
  ],
  unscheduled: 0, missed: 0, ...over,
})
const open = async (tasks: Task[] = [exam()]) => { await act(async () => { render(<ConfirmProvider><StudyPlanPanel courses={courses} tasks={tasks} /></ConfirmProvider>) }) }
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  views = []; failed = false; setDone.mockClear(); reload.mockClear(); start.mockClear(); savePlan.mockClear(); deletePlan.mockClear()
})
afterEach(cleanup)

describe('Study plan panel', () => {
  it('offers a plan for every course without one, exams or not', async () => {
    await open([])
    expect(screen.getByRole('button', { name: 'Make a study plan for Biology' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Make a study plan for Chemistry' })).toBeTruthy()
    cleanup()
    views = [view()]
    await open([])
    expect(screen.queryByRole('button', { name: 'Make a study plan for Biology' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Make a study plan for Chemistry' })).toBeTruthy()
  })
  it('a course with no exam gets a plan that keeps going', async () => {
    await open([])
    fireEvent.click(screen.getByRole('button', { name: 'Make a study plan for Chemistry' }))
    expect((screen.getByLabelText('Working towards') as HTMLSelectElement).value).toBe('')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save plan' })) })
    expect(savePlan).toHaveBeenCalledWith(expect.anything(), { course_id: 'c2', exam_task_id: null, mode: 'balanced', minutes_per_day: 45, days_off: [] })
    expect(reload).toHaveBeenCalled()
  })
  it('works towards the course\'s next saved, upcoming exam by default, and can choose another or none', async () => {
    const soon = exam({ id: 'e1', title: 'Soon', due_at: new Date(Date.now() + 5 * 86_400_000).toISOString() })
    const later = exam({ id: 'e2', title: 'Later', due_at: new Date(Date.now() + 20 * 86_400_000).toISOString() })
    const past = exam({ id: 'e3', title: 'Past', due_at: new Date(Date.now() - 86_400_000).toISOString() })
    const undated = exam({ id: 'e4', title: 'Undated', due_at: null })
    const unsaved = exam({ id: 'temp-1', title: 'Unsaved' })
    const assignment = exam({ id: 'e5', title: 'Essay', type: 'assignment' })
    await open([later, soon, past, undated, unsaved, assignment])
    fireEvent.click(screen.getByRole('button', { name: 'Make a study plan for Biology' }))
    const aim = screen.getByLabelText('Working towards') as HTMLSelectElement
    expect([...aim.options].map(o => o.text)).toEqual(['No exam: keep going', 'Soon', 'Later'])
    expect(aim.value).toBe('e1')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save plan' })) })
    expect(savePlan).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ course_id: 'c1', exam_task_id: 'e1' }))
  })
  it('says what to do when there is no course to plan', async () => {
    await act(async () => { render(<ConfirmProvider><StudyPlanPanel courses={[]} tasks={[]} /></ConfirmProvider>) })
    expect(screen.getByText('Add a course to make a study plan.')).toBeTruthy()
  })
  it('a plan with no exam says it keeps going', async () => {
    views = [view({ examDay: null, daysToExam: null, plan: { ...view().plan, exam_task_id: null, exam: null } })]
    await open([])
    expect(screen.getByRole('region', { name: 'Study plan' }).textContent).toMatch(/Balanced.*45 min a day.*Ongoing, no exam/)
  })
  it('shows a plan: its summary, today\'s sessions, the next days, and ticks a session', async () => {
    views = [view()]
    await open()
    const panel = screen.getByRole('region', { name: 'Study plan' })
    expect(panel.textContent).toContain('Biology')
    expect(panel.textContent).toMatch(/Balanced.*45 min a day.*Midterm in 14 days/)
    expect(within(panel).getByText('Learn: Krebs cycle')).toBeTruthy()
    fireEvent.click(within(panel).getByRole('checkbox', { name: 'Mark Learn: Krebs cycle done' }))
    expect(setDone).toHaveBeenCalledWith('p1', 's1', true)
    expect(within(panel).getByText(/Learn: Glycolysis \(25 min\)/)).toBeTruthy()
    fireEvent.click(within(panel).getByRole('button', { name: 'Start warm-up' }))
    expect(start).toHaveBeenCalledWith(expect.objectContaining({ id: 's2', noteId: 'n2' }))
  })
  it('the full schedule shows every day, and hides again', async () => {
    views = [view()]
    await open()
    expect(screen.queryByText(/Revise: Krebs cycle \(15 min\)/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Full schedule' }))
    expect(screen.getByText(/Revise: Krebs cycle \(15 min\)/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Hide full schedule' }))
    expect(screen.queryByText(/Revise: Krebs cycle \(15 min\)/)).toBeNull()
  })
  it('says when nothing is planned today, and what was missed or does not fit', async () => {
    views = [view({ today: [], missed: 2, unscheduled: 3 })]
    await open()
    expect(screen.getByText('Nothing planned for today.')).toBeTruthy()
    expect(screen.getByText('Missed this week: 2')).toBeTruthy()
    expect(screen.getByText(/3 sessions don't fit/)).toBeTruthy()
  })
  it('no topics sends the student to Progress; an exam too close says so', async () => {
    views = [view({ status: 'no_topics', today: [], upcoming: [], schedule: [] })]
    await open()
    expect(screen.getByText(/Draft topics for Biology on Progress first/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open Progress' }).getAttribute('href')).toBe('/progress')
    cleanup()
    views = [view({ status: 'no_days', today: [], upcoming: [], schedule: [] })]
    await open()
    expect(screen.getByText('Your exam is too close for a plan.')).toBeTruthy()
  })
  it('edits the plan\'s settings, and deletes it after confirming', async () => {
    views = [view()]
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Edit plan' }))
    fireEvent.click(screen.getByRole('radio', { name: /Sprint/ }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save plan' })) })
    expect(savePlan).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ mode: 'sprint' }), 'p1')
    fireEvent.click(screen.getByRole('button', { name: 'Delete plan' }))
    await act(async () => { fireEvent.click(screen.getByRole('dialog').querySelector('button.btn-danger') as HTMLElement) })
    expect(deletePlan).toHaveBeenCalledWith(expect.anything(), 'p1')
    expect(reload).toHaveBeenCalled()
  })
  it('keeps the form open and says so when saving fails', async () => {
    savePlan.mockRejectedValueOnce(new Error('rls'))
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Make a study plan for Biology' }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save plan' })) })
    expect(screen.getByRole('alert').textContent).toMatch(/Couldn't save the plan/)
  })
  it('a failed load is an error with Try again, and offers no new plan (which could replace a live one)', async () => {
    views = []; failed = true
    await open()
    expect(screen.getByRole('alert').textContent).toMatch(/Couldn't load your study plans/)
    expect(screen.queryByRole('button', { name: /Make a study plan/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(reload).toHaveBeenCalled()
  })
})
