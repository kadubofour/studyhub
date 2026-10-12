// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'
import type { Profile } from '@/lib/types'
import type { XpSummary } from '@/lib/xp/rules'
import type { Stats } from '@/lib/profile/badges'

const STATS: Stats = { notes: 12, decks: 3, cards: 80, lectures: 2, lecture_minutes: 95, quizzes_done: 5, focus_minutes: 330, reviews: 140, games: 1, tutor_messages: 4, courses: 2 }
const base = { id: 'u1', display_name: 'Ama Mensah', school: 'University of Ghana', programme: 'Biology', avatar_color: '#3B5BDB', timezone: 'UTC', daily_goal_minutes: 120, focus_minutes: 25, short_break_minutes: 5, long_break_minutes: 15, long_break_every: 4, default_editor_mode: 'rich', theme: 'system', accent: 'blue', font: 'sans', look: 'vivid', auto_math: true, onboarded: true } as Profile
const xpOf = (over: Partial<XpSummary> = {}): XpSummary => ({ total: 120, today: 0, level: { level: 2, into: 70, span: 150, toNext: 80 }, streak: 3, best: 8, goals: [], allDone: false, bonus: 20, last14: [], ...over })
let statsFail = false
let xp: XpSummary | null
let saveFails = false
let plan = { billing: true, loading: false, isPremium: false, premiumUntil: null as Date | null }
const updateProfile = vi.fn(async (_sb: unknown, _id: string, patch: object) => { if (saveFails) throw new Error('offline'); return { ...base, ...patch } })
vi.mock('next-themes', () => ({ useTheme: () => ({ setTheme: vi.fn(), resolvedTheme: 'light' }) }))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({ auth: { getUser: async () => ({ data: { user: { email: 'ama@example.test', created_at: '2026-10-03T10:00:00Z' } } }) } }) }))
vi.mock('@/lib/data/profile', () => ({ getProfileStats: async () => { if (statsFail) throw new Error('offline'); return STATS }, updateProfile: (...a: [unknown, string, object]) => updateProfile(...a) }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => [{ id: 'bio', name: 'Biology', color: '#1D9E75' }, { id: 'lang', name: 'Spanish', color: '#BA7517' }] }))
vi.mock('@/components/xp/useXp', () => ({ useXp: () => ({ xp, reload: vi.fn() }) }))
vi.mock('@/components/billing/usePlan', () => ({ usePlan: () => plan }))
import ProfilePage from '@/app/(app)/profile/page'
import { ProfileProvider } from '@/components/providers/ProfileProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'

const open = async (profile: Profile = base) => { await act(async () => { render(<ProfileProvider initial={profile}><ToastProvider><ProfilePage /></ToastProvider></ProfileProvider>) }) }
const click = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el) }) }
beforeEach(() => { statsFail = false; xp = xpOf(); saveFails = false; plan = { billing: true, loading: false, isPremium: false, premiumUntil: null }; updateProfile.mockClear() })
afterEach(cleanup)

describe('Profile page: who the student is', () => {
  it('shows the name, programme and school, email, and when they joined', async () => {
    await open()
    expect(screen.getByRole('heading', { level: 1, name: 'Ama Mensah' })).toBeTruthy()
    expect(screen.getByText('Biology · University of Ghana')).toBeTruthy()
    expect(screen.getByText('ama@example.test')).toBeTruthy()
    expect(screen.getByText('Member since October 2026')).toBeTruthy()
  })
  it('shows initials on the chosen colour, kept out of the reading order', async () => {
    await open()
    const avatar = screen.getByTestId('avatar')
    expect(avatar.textContent).toBe('AM')
    expect(avatar.getAttribute('aria-hidden')).toBe('true')
    expect((avatar as HTMLElement).style.background).toMatch(/rgb\(59, 91, 219\)|#3b5bdb/i)
  })
  it('copes with a student who has no name or school yet', async () => {
    await open({ ...base, display_name: null, school: null, programme: null })
    expect(screen.getByRole('heading', { level: 1, name: 'Your profile' })).toBeTruthy()
    expect(screen.getByTestId('avatar').textContent).toBe('A') // from the email
    expect(within(screen.getByRole('region', { name: 'Your profile' })).queryByText(/·/)).toBeNull()
  })
  it('names the plan', async () => {
    await open()
    expect(screen.getByText('Free plan')).toBeTruthy()
    cleanup()
    plan = { billing: true, loading: false, isPremium: true, premiumUntil: new Date('2026-11-03T00:00:00Z') }
    await open()
    expect(screen.getByText('Premium until 3 Nov 2026')).toBeTruthy()
  })
  it('says nothing about a plan when payments are not on', async () => {
    plan = { billing: false, loading: false, isPremium: false, premiumUntil: null }
    await open()
    expect(screen.queryByText(/plan/i)).toBeNull()
  })
})

describe('Profile page: when XP cannot be read', () => {
  it('still shows the totals that were read, and does not show badges that need XP as locked', async () => {
    xp = null
    await open()
    const tiles = screen.getByRole('list', { name: 'Study totals' })
    expect(within(tiles).getByText('Notes').closest('li')!.textContent).toContain('12')
    expect(within(tiles).queryByText('Level')).toBeNull()
    expect(within(tiles).queryByText('Streak')).toBeNull()
    expect(screen.queryByRole('list', { name: 'Badges' })).toBeNull()
  })
})

describe('Profile page: what the student has done', () => {
  it('shows the totals', async () => {
    await open()
    const tiles = screen.getByRole('list', { name: 'Study totals' })
    const t = (label: string) => within(tiles).getByText(label).closest('li')!.textContent
    expect(t('Level')).toContain('2')
    expect(t('Streak')).toContain('3 days')
    expect(t('Best streak')).toContain('8 days')
    expect(t('Focus time')).toContain('5h 30m')
    expect(t('Notes')).toContain('12')
    expect(t('Flashcards')).toContain('80')
    expect(t('Lectures')).toContain('2')
    expect(t('Quizzes finished')).toContain('5')
  })
  it('shows the progress to the next level in words', async () => {
    await open()
    const bar = screen.getByRole('progressbar', { name: 'Progress to level 3' })
    expect(bar.getAttribute('aria-valuetext')).toBe('70 of 150 XP')
    expect(screen.getByText('120 XP in all')).toBeTruthy()
  })
  it('shows which badges are earned and the progress on the rest', async () => {
    await open()
    expect(screen.getByText('8 of 12 badges earned')).toBeTruthy() // first note, note-taker, card collector, reviewer, first lecture, quiz ace, and both streaks
  })
  it('says a badge is earned or locked in words, with how far along it is', async () => {
    await open()
    const badges = screen.getByRole('list', { name: 'Badges' })
    const note = within(badges).getByText('Note-taker').closest('li')!
    expect(note.textContent).toContain('Earned')
    const cards = within(badges).getByText('Card collector').closest('li')!
    expect(cards.textContent).toContain('Earned')
    const curious = within(badges).getByText('Curious').closest('li')!
    expect(curious.textContent).toContain('Locked')
    expect(curious.textContent).toContain('4 / 20')
    expect(curious.textContent).toContain('Ask the tutor 20 times')
  })
  it('keeps going when the totals cannot be loaded', async () => {
    statsFail = true
    await open()
    expect(screen.getByRole('alert').textContent).toContain('Could not load your study totals')
    expect(screen.getByRole('heading', { level: 1, name: 'Ama Mensah' })).toBeTruthy()
    const tiles = screen.getByRole('list', { name: 'Study totals' })
    expect(within(tiles).getByText('Level')).toBeTruthy() // what came from XP still shows
    expect(within(tiles).queryByText('Notes')).toBeNull()
  })
  it('links each course to its place in the Library', async () => {
    await open()
    const courses = screen.getByRole('list', { name: 'Your courses' })
    expect(within(courses).getByRole('link', { name: 'Biology' }).getAttribute('href')).toBe('/library?course=bio')
    expect(within(courses).getByRole('link', { name: 'Spanish' }).getAttribute('href')).toBe('/library?course=lang')
  })
})

describe('Profile page: editing', () => {
  const edit = async () => { await click(screen.getByRole('button', { name: 'Edit profile' })) }
  it('saves the name, school, programme and colour, and the page shows them at once', async () => {
    await open()
    await edit()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ama K. Mensah' } })
    fireEvent.change(screen.getByLabelText('School'), { target: { value: 'KNUST' } })
    fireEvent.change(screen.getByLabelText('Programme'), { target: { value: 'Pharmacy' } })
    await click(screen.getByRole('radio', { name: 'Pink' }))
    await click(screen.getByRole('button', { name: 'Save' }))
    expect(updateProfile).toHaveBeenCalledWith(expect.anything(), 'u1', { display_name: 'Ama K. Mensah', school: 'KNUST', programme: 'Pharmacy', avatar_color: '#BE185D' })
    expect(screen.getByRole('heading', { level: 1, name: 'Ama K. Mensah' })).toBeTruthy()
    expect(screen.getByText('Pharmacy · KNUST')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
  })
  it('keeps the old name when the name is cleared, and clears school and programme to nothing', async () => {
    await open()
    await edit()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '   ' } })
    fireEvent.change(screen.getByLabelText('School'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Programme'), { target: { value: '  ' } })
    await click(screen.getByRole('button', { name: 'Save' }))
    expect(updateProfile).toHaveBeenCalledWith(expect.anything(), 'u1', { school: null, programme: null, avatar_color: '#3B5BDB' })
    expect(screen.getByRole('heading', { level: 1, name: 'Ama Mensah' })).toBeTruthy()
  })
  it('limits the fields to 80 characters', async () => {
    await open()
    await edit()
    for (const label of ['Name', 'School', 'Programme']) expect(screen.getByLabelText(label).getAttribute('maxlength')).toBe('80')
  })
  it('moves between the colours with the arrow keys', async () => {
    await open()
    await edit()
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Blue' }), { key: 'ArrowRight' })
    expect(screen.getByRole('radio', { name: 'Violet' }).getAttribute('aria-checked')).toBe('true')
  })
  it('says it could not save, and keeps the form open with what was typed', async () => {
    saveFails = true
    await open()
    await edit()
    fireEvent.change(screen.getByLabelText('School'), { target: { value: 'KNUST' } })
    await click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert').textContent).toContain('Could not save')
    expect((screen.getByLabelText('School') as HTMLInputElement).value).toBe('KNUST')
    expect(screen.getByText('Biology · University of Ghana')).toBeTruthy() // the page still shows what is saved
  })
  it('puts everything back when cancelled', async () => {
    await open()
    await edit()
    fireEvent.change(screen.getByLabelText('School'), { target: { value: 'KNUST' } })
    await click(screen.getByRole('button', { name: 'Cancel' }))
    await edit()
    expect((screen.getByLabelText('School') as HTMLInputElement).value).toBe('University of Ghana')
    expect(updateProfile).not.toHaveBeenCalled()
  })
  it('offers eight colours as a group of radio buttons with the current one chosen', async () => {
    await open()
    await edit()
    const group = screen.getByRole('radiogroup', { name: 'Avatar colour' })
    expect(within(group).getAllByRole('radio')).toHaveLength(8)
    expect(within(group).getByRole('radio', { name: 'Blue' }).getAttribute('aria-checked')).toBe('true')
    expect(within(group).getAllByRole('radio').filter(r => r.getAttribute('tabindex') === '0')).toHaveLength(1) // arrow keys move between them
  })
  it('saves once when Save is pressed twice', async () => {
    await open()
    await edit()
    const save = screen.getByRole('button', { name: 'Save' })
    await act(async () => { fireEvent.click(save); fireEvent.click(save) })
    expect(updateProfile).toHaveBeenCalledTimes(1)
  })
})
