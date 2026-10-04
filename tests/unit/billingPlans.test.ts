import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { CHOICES, FAIR_USE_MONTHLY_ACTIONS, FAIR_USE_TRANSCRIPT_HOURS, FREE_DAILY_ACTIONS, PRODUCTS, SPEED_LIMIT_PER_MINUTE, formatGhs, pdfActionCost } from '@/lib/billing/plans'

// The definition of a SQL function the database actually runs: the one in the newest migration
function latestDefinition(fn: string): string {
  const dir = 'supabase/migrations'
  const marker = new RegExp(`create (or replace )?function public\\.${fn}\\(`)
  const file = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort().reverse()
    .map(f => fs.readFileSync(`${dir}/${f}`, 'utf8').replace(/\r\n/g, '\n'))
    .find(sql => marker.test(sql))!
  const start = file.search(marker)
  return file.slice(start, file.indexOf('end $$;', start))
}

describe('plan constants', () => {
  it('match the limits enforced in SQL', () => {
    const check = latestDefinition('ai_check')
    expect(check).toContain(`> ${FREE_DAILY_ACTIONS} then return 'daily_limit'`)
    expect(check).toContain(`> ${FAIR_USE_MONTHLY_ACTIONS} then return 'fair_use'`)
    expect(check).toContain(`>= ${SPEED_LIMIT_PER_MINUTE} then\n    return 'rate_limited'`)
    expect(latestDefinition('transcription_check')).toContain(`> ${FAIR_USE_TRANSCRIPT_HOURS * 3600} then return 'fair_use'`)
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
