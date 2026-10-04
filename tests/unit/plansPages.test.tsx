// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'

vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({ from: () => ({ select: () => ({ maybeSingle: async () => ({ data: null }), gte: async () => ({ data: [] }) }) }) }) }))
import { PlanPicker } from '@/components/billing/PlanPicker'
import { ReturnStatus } from '@/components/billing/ReturnStatus'

const fetchMock = vi.fn()
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }))
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset() })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })

describe('PlanPicker', () => {
  it('shows Free and Premium with the three options and sends the student to Paystack', async () => {
    fetchMock.mockImplementation(() => json({ url: 'https://pay/x' }))
    const go = vi.fn()
    render(<PlanPicker go={go} />)
    expect(screen.getByText('GHS 135')).toBeTruthy()
    expect(screen.getByText('save 20%')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: /1 year/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Renew automatically (card only)' }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Pay GHS 480 with Paystack' })) })
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({ choice: '12m', autoRenew: true })
    expect(go).toHaveBeenCalledWith('https://pay/x')
  })
  it('disables auto-renew for 3 months', () => {
    render(<PlanPicker go={() => {}} />)
    fireEvent.click(screen.getByRole('radio', { name: /3 months/ }))
    expect((screen.getByRole('checkbox', { name: 'Renew automatically (card only)' }) as HTMLInputElement).disabled).toBe(true)
  })
  it('explains a checkout that could not start', async () => {
    fetchMock.mockImplementation(() => json({ error: 'checkout_failed' }, 502))
    render(<PlanPicker go={() => {}} />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Pay GHS 50 with Paystack' })) })
    expect(screen.getByRole('alert').textContent).toBe('Couldn\'t start checkout. Try again.')
  })
})

describe('ReturnStatus', () => {
  it('shows Premium as soon as the payment is confirmed', async () => {
    fetchMock.mockImplementation(() => json({ state: 'credited', premiumUntil: '2026-12-03T10:00:00Z' }))
    render(<ReturnStatus reference="R1" />)
    expect(await screen.findByText(/You're on Premium until 3 Dec 2026/)).toBeTruthy()
  })
  it('keeps checking a pending payment, then says it will switch on later', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    fetchMock.mockImplementation(() => json({ state: 'pending', premiumUntil: null }))
    render(<ReturnStatus reference="R1" pollMs={1000} maxMs={3000} />)
    expect(screen.getByText('Confirming your payment…')).toBeTruthy()
    await act(async () => { await vi.advanceTimersByTimeAsync(3500) })
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3)
    expect(screen.getByText(/We'll switch you to Premium as soon as Paystack confirms/)).toBeTruthy()
  })
  it('says a failed payment did not go through', async () => {
    fetchMock.mockImplementation(() => json({ state: 'failed', premiumUntil: null }))
    render(<ReturnStatus reference="R1" />)
    expect(await screen.findByText('Payment didn\'t go through. You haven\'t been charged.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Try again' }).getAttribute('href')).toBe('/plans')
  })
})
