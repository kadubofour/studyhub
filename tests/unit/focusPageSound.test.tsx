// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { Profile } from '@/lib/types'

vi.mock('@/lib/data/focus', () => ({ logFocusSession: async () => {}, listSessionsSince: async () => [] }))
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))

import { ProfileProvider } from '@/components/providers/ProfileProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'
import { FocusProvider } from '@/components/providers/FocusProvider'
import FocusPage from '@/app/(app)/focus/page'

const profile: Profile = {
  id: 'u', display_name: 'Ama', timezone: 'UTC', daily_goal_minutes: 120, focus_minutes: 25,
  short_break_minutes: 5, long_break_minutes: 15, long_break_every: 4, default_editor_mode: 'rich',
  theme: 'system', accent: 'blue', font: 'sans', look: 'classic', auto_math: true, onboarded: true,
}

const srcSets: string[] = []
beforeAll(() => {
  window.HTMLMediaElement.prototype.play = function () { return Promise.resolve() }
  window.HTMLMediaElement.prototype.pause = function () {}
  const desc = Object.getOwnPropertyDescriptor(window.HTMLMediaElement.prototype, 'src')!
  Object.defineProperty(window.HTMLMediaElement.prototype, 'src', {
    configurable: true,
    get() { return desc.get!.call(this) },
    set(v: string) { srcSets.push(v); desc.set!.call(this, v) },
  })
})

describe('Focus page sounds', () => {
  it('changing the volume adjusts the level without restarting the loop', async () => {
    render(
      <ProfileProvider initial={profile}>
        <ToastProvider><FocusProvider><FocusPage /></FocusProvider></ToastProvider>
      </ProfileProvider>,
    )
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Rain' })) })
    const before = srcSets.length
    expect(before).toBe(1)
    const slider = screen.getByLabelText('Volume') as HTMLInputElement
    await act(async () => { fireEvent.change(slider, { target: { value: '0.3' } }) })
    await act(async () => { fireEvent.change(slider, { target: { value: '0.9' } }) })
    expect(srcSets.length).toBe(before)
    expect((document.querySelector('audio') as HTMLAudioElement).volume).toBeCloseTo(0.9)
  })
})
