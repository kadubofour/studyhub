import { describe, it, expect } from 'vitest'
import { retention, countByDay } from '@/lib/stats'

describe('retention', () => {
  it('is the share of reviews rated Good or Easy', () => {
    expect(retention([{ rating: 1 }, { rating: 2 }, { rating: 3 }, { rating: 4 }])).toBe(0.5)
  })
  it('is null with no reviews', () => {
    expect(retention([])).toBeNull()
  })
})

describe('countByDay', () => {
  it('counts per local day', () => {
    const m = countByDay(['2026-10-01T10:00:00Z', '2026-10-01T11:00:00Z', '2026-10-02T10:00:00Z'], 'UTC')
    expect(m.get('2026-10-01')).toBe(2)
    expect(m.get('2026-10-02')).toBe(1)
  })
})
