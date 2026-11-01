// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'

const update = vi.fn(), insert = vi.fn()
const sb = {
  auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
  from: (t: string) => t === 'profiles'
    ? { update: (p: object) => { update(p); return { eq: async () => ({ error: null }) } } }
    : { insert: async (r: object) => { insert(r); return { error: null } } },
}
vi.mock('@/lib/supabase/client', () => ({ supabase: () => sb }))
const router = { replace: vi.fn(), refresh: vi.fn() }
vi.mock('next/navigation', () => ({ useRouter: () => router, useSearchParams: () => new URLSearchParams('') }))
vi.mock('@/components/setup/ProgrammeSetup', () => ({
  ProgrammeSetup: ({ about, existing }: { about: { programme: string; year: string }; existing: string[] }) =>
    <p>Courses for {about.programme} {about.year} (has {existing.join(',') || 'none'})</p>,
}))
import OnboardingPage from '@/app/onboarding/page'

const open = async () => { await act(async () => { render(<OnboardingPage />) }) }
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
beforeEach(() => { update.mockClear(); insert.mockClear(); router.replace.mockClear() })
afterEach(cleanup)

describe('onboarding', () => {
  it('without a programme finishes as it always did: the first course, then on', async () => {
    await open()
    type('Your first course', 'Biology')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Continue' })) })
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ name: 'Biology' }))
    expect(router.replace).toHaveBeenCalledWith('/home')
  })
  it('with a programme saves it, then goes to the courses for it instead of leaving', async () => {
    await open()
    type('School', 'University of Ghana'); type('Programme', 'BSc Biology'); type('Your first course', 'Biology')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Continue' })) })
    expect(update.mock.calls[0][0]).toMatchObject({ onboarded: true, school: 'University of Ghana', programme: 'BSc Biology' })
    expect(router.replace).not.toHaveBeenCalled()
    expect(screen.getByText('Courses for BSc Biology (has Biology)')).toBeTruthy()
  })
  it('Skip saves nothing of what was typed and leaves', async () => {
    await open()
    type('Programme', 'BSc Biology')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Skip' })) })
    expect(update.mock.calls[0][0]).not.toHaveProperty('programme')
    expect(router.replace).toHaveBeenCalledWith('/home')
  })
})
