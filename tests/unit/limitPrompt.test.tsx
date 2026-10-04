// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { LimitPrompt } from '@/components/billing/LimitPrompt'
import { AiError } from '@/components/ai/AiError'
import { freeAllowanceText, loadPlan } from '@/components/billing/usePlan'

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-04T17:20:00Z')); process.env.NEXT_PUBLIC_BILLING_ENABLED = '1' })
afterEach(() => { cleanup(); vi.useRealTimers(); delete process.env.NEXT_PUBLIC_BILLING_ENABLED })

describe('LimitPrompt', () => {
  it('explains the free daily limit with the reset time and a Get Premium link', () => {
    render(<LimitPrompt kind="daily_limit" />)
    expect(screen.getByText('You\'ve used today\'s 10 free AI actions')).toBeTruthy()
    expect(screen.getByText(/They reset in 6h 40m\. Premium has no daily limit\./)).toBeTruthy()
    expect(screen.getByRole('link', { name: '✦ Get Premium · GHS 50/month' }).getAttribute('href')).toBe('/plans')
  })
  it('explains Premium fair use', () => {
    render(<LimitPrompt kind="fair_use" />)
    expect(screen.getByText('You\'ve reached fair use for this month')).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Get Premium/ })).toBeNull()
  })
  it('hides the upgrade link when billing is not set up', () => {
    delete process.env.NEXT_PUBLIC_BILLING_ENABLED
    render(<LimitPrompt kind="daily_limit" />)
    expect(screen.queryByRole('link', { name: /Get Premium/ })).toBeNull()
  })
})

describe('AiError', () => {
  it('shows the limit prompt for plan limits and a plain alert otherwise', () => {
    const { rerender } = render(<AiError code="daily_limit" message="x" />)
    expect(screen.getByText('You\'ve used today\'s 10 free AI actions')).toBeTruthy()
    rerender(<AiError code="busy" message="Couldn't reach the AI. Try again." />)
    expect(screen.getByRole('alert').textContent).toBe('Couldn\'t reach the AI. Try again.')
  })
})

describe('plan state', () => {
  it('counts today\'s and this month\'s usage and reads Premium', async () => {
    const sb = {
      from: (t: string) => t === 'entitlements'
        ? { select: () => ({ maybeSingle: async () => ({ data: { premium_until: '2026-11-04T00:00:00Z', auto_renew: true, card_brand: 'visa', card_last4: '4242' }, error: null }) }) }
        : { select: () => ({ gte: async () => ({ data: [{ cost: 2, at: '2026-10-04T08:00:00Z' }, { cost: 3, at: '2026-10-01T08:00:00Z' }], error: null }) }) },
    }
    const p = await loadPlan(sb as never, new Date('2026-10-04T17:20:00Z'))
    expect(p).toMatchObject({ isPremium: true, autoRenew: true, cardLabel: 'Visa •• 4242', usedToday: 2, usedThisMonth: 5 })
    expect(freeAllowanceText(3)).toBe('7 of 10 free AI actions left today')
  })
})
