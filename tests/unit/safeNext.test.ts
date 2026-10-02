import { describe, it, expect } from 'vitest'
import { safeNext } from '@/lib/safeNext'

describe('safeNext', () => {
  it('keeps same-site paths', () => {
    expect(safeNext('/planner')).toBe('/planner')
    expect(safeNext('/notes/abc?x=1')).toBe('/notes/abc?x=1')
  })
  it('rejects external and protocol-relative URLs', () => {
    expect(safeNext('https://evil.example/login')).toBe('/home')
    expect(safeNext('//evil.example')).toBe('/home')
    expect(safeNext('/\\evil.example')).toBe('/home')
    expect(safeNext('javascript:alert(1)')).toBe('/home')
  })
  it('falls back when missing', () => {
    expect(safeNext(null)).toBe('/home')
    expect(safeNext('')).toBe('/home')
  })
})
