// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest'
import { createElement } from 'react'
import { render, screen, act, waitFor } from '@testing-library/react'
import { ThemeProvider, useTheme } from 'next-themes'
import { ProfileProvider } from '@/components/providers/ProfileProvider'
import type { Profile } from '@/lib/types'

beforeAll(() => {
  // next-themes reads the system preference
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia
})

const profile: Profile = {
  id: 'u', display_name: 'Ama', timezone: 'UTC', daily_goal_minutes: 120, focus_minutes: 25,
  short_break_minutes: 5, long_break_minutes: 15, long_break_every: 4, default_editor_mode: 'rich',
  theme: 'light', onboarded: true,
}

function Switcher() {
  const { setTheme } = useTheme()
  return createElement('button', { onClick: () => setTheme('dark') }, 'go dark')
}

describe('ProfileProvider theme', () => {
  it('applies the saved theme on load but does not undo a later change', async () => {
    render(createElement(ThemeProvider, { attribute: 'class', enableSystem: true },
      createElement(ProfileProvider, { initial: profile }, createElement(Switcher))))
    await waitFor(() => expect(document.documentElement.className).toBe('light'))
    act(() => { screen.getByText('go dark').click() })
    await new Promise(r => setTimeout(r, 50))
    expect(document.documentElement.className).toBe('dark')
  })
})
