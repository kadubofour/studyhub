// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

vi.mock('@/lib/focus/alert', () => ({ notificationPermission: () => 'default', askNotificationPermission: async () => 'granted' }))
import { RemindersCard } from '@/components/settings/RemindersCard'
afterEach(cleanup)

describe('the automatic reminders settings', () => {
  it('point to the student\'s own reminders, which are in the Planner', () => {
    render(<RemindersCard />)
    expect(screen.getByRole('link', { name: /Your own reminders/ }).getAttribute('href')).toBe('/planner?list=reminders')
  })
})
