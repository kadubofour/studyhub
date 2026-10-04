import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { CHOICES, FAIR_USE_MONTHLY_ACTIONS, FREE_DAILY_ACTIONS, PRODUCTS, SPEED_LIMIT_PER_MINUTE, formatGhs, pdfActionCost } from '@/lib/billing/plans'

const sql = fs.readFileSync('supabase/migrations/20261007000000_billing.sql', 'utf8')

describe('plan constants', () => {
  it('match the limits enforced in SQL', () => {
    expect(sql).toContain(`> ${FREE_DAILY_ACTIONS} then return 'daily_limit'`)
    expect(sql).toContain(`> ${FAIR_USE_MONTHLY_ACTIONS} then return 'fair_use'`)
    expect(sql).toContain(`>= ${SPEED_LIMIT_PER_MINUTE} then\n    return 'rate_limited'`)
  })
  it('have the agreed prices in pesewas', () => {
    expect(PRODUCTS.pass_1m).toMatchObject({ months: 1, amountMinor: 5000 })
    expect(PRODUCTS.pass_3m).toMatchObject({ months: 3, amountMinor: 13500 })
    expect(PRODUCTS.pass_12m).toMatchObject({ months: 12, amountMinor: 48000 })
    expect(PRODUCTS.renew_1m.amountMinor).toBe(5000)
    expect(PRODUCTS.renew_12m.amountMinor).toBe(48000)
    expect(CHOICES['3m'].renew).toBeNull() // no auto-renew for 3 months
  })
  it('formats cedis', () => {
    expect(formatGhs(5000)).toBe('GHS 50')
    expect(formatGhs(13550)).toBe('GHS 135.50')
  })
  it('costs PDFs 1 AI action per 10 pages', () => {
    expect([0, 1, 10, 11, 25, 100, 400].map(pdfActionCost)).toEqual([1, 1, 1, 2, 3, 10, 10])
  })
})
