// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'

let ent: Record<string, unknown> | null
let payments: Record<string, unknown>[] = []
const tables: string[] = []
vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({
  from: (t: string) => (tables.push(t), t) === 'entitlements'
    ? { select: () => ({ maybeSingle: async () => ({ data: ent }) }) }
    : t === 'payments'
      ? { select: () => ({ order: () => ({ limit: async () => ({ data: payments }) }) }) }
      : { select: () => ({ gte: async () => ({ data: [{ cost: 112, at: new Date().toISOString() }] }) }) },
}) }))
import { PlanCard } from '@/components/settings/PlanCard'
import { endingSoon } from '@/components/billing/EndingBanner'
import { ConfirmProvider } from '@/components/providers/ConfirmProvider'

const fetchMock = vi.fn()
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); process.env.NEXT_PUBLIC_BILLING_ENABLED = '1'
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  ent = { premium_until: '2026-12-03T10:00:00Z', auto_renew: true, card_brand: 'visa', card_last4: '4242' }
  payments = [{ id: 'p1', product: 'pass_1m', amount_minor: 5000, channel: 'mobile_money', status: 'success', paid_at: '2026-10-03T10:00:00Z', created_at: '2026-10-03T10:00:00Z' }]
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); delete process.env.NEXT_PUBLIC_BILLING_ENABLED })
const renderCard = () => render(<ConfirmProvider><PlanCard /></ConfirmProvider>)

describe('PlanCard', () => {
  it('shows Premium, renewal, fair-use usage and payment history', async () => {
    renderCard()
    expect(await screen.findByText('✦ Premium')).toBeTruthy()
    expect(screen.getByText(/until 3 Dec 2026/)).toBeTruthy()
    expect(screen.getByText(/Renews automatically \(Visa •• 4242\)/)).toBeTruthy()
    expect(screen.getByText('This month: 112 of 400 AI actions')).toBeTruthy()
    expect(screen.getByText(/3 Oct 2026 · 1 month · GHS 50 · MoMo/)).toBeTruthy()
  })
  it('turns off renewal after confirming', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    renderCard()
    const turnOff = await screen.findByRole('button', { name: 'Turn off renewal' })
    await act(async () => { fireEvent.click(turnOff) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Turn off' })) })
    expect(fetchMock).toHaveBeenCalledWith('/api/billing/cancel-renewal', { method: 'POST' })
  })
  it('shows Free with a Get Premium link when there is no plan', async () => {
    ent = null; payments = []
    renderCard()
    expect(await screen.findByText('Free')).toBeTruthy()
    expect(screen.getByRole('link', { name: '✦ Get Premium' }).getAttribute('href')).toBe('/plans')
  })
})

describe('PlanCard with billing off', () => {
  it('renders nothing and loads no payments', async () => {
    delete process.env.NEXT_PUBLIC_BILLING_ENABLED
    tables.length = 0
    payments = [{ id: 'p1', product: 'pass_1m', amount_minor: 5000, channel: 'card', status: 'success', paid_at: null, created_at: '2026-10-03T10:00:00Z' }]
    const { container } = renderCard()
    await act(async () => {})
    expect(container.textContent).toBe('')
    expect(tables).not.toContain('payments')
  })
})

describe('endingSoon', () => {
  const now = new Date('2026-10-04T12:00:00Z')
  it('warns within 7 days for a pass, not with auto-renew or when far off', () => {
    expect(endingSoon({ isPremium: true, autoRenew: false, premiumUntil: new Date('2026-10-09T12:00:00Z') }, now)).toEqual({ days: 5, date: '9 Oct' })
    expect(endingSoon({ isPremium: true, autoRenew: true, premiumUntil: new Date('2026-10-09T12:00:00Z') }, now)).toBeNull()
    expect(endingSoon({ isPremium: true, autoRenew: false, premiumUntil: new Date('2026-10-20T12:00:00Z') }, now)).toBeNull()
    expect(endingSoon({ isPremium: false, autoRenew: false, premiumUntil: null }, now)).toBeNull()
  })
})
