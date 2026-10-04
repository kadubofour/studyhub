import { describe, it, expect, afterEach } from 'vitest'
import { AUDIO_QUOTA_BYTES, formatClock, formatMb, lineAt, locate, partSeconds, searchLines, storageState } from '@/lib/lectures/time'

afterEach(() => { delete process.env.NEXT_PUBLIC_LECTURE_PART_SECONDS })

describe('formatClock', () => {
  it('shows m:ss, or h:mm:ss from an hour', () => {
    expect([0, 9, 75, 3599, 3723, 7200].map(formatClock)).toEqual(['0:00', '0:09', '1:15', '59:59', '1:02:03', '2:00:00'])
  })
})

describe('locate', () => {
  const parts = [{ start: 0, duration: 1200 }, { start: 1200, duration: 1200 }, { start: 2400, duration: 300 }]
  it('finds the part and the offset in it for a lecture time', () => {
    expect(locate(parts, 0)).toEqual({ index: 0, offset: 0 })
    expect(locate(parts, 1199.5)).toEqual({ index: 0, offset: 1199.5 })
    expect(locate(parts, 1200)).toEqual({ index: 1, offset: 0 })
    expect(locate(parts, 2500)).toEqual({ index: 2, offset: 100 })
  })
  it('keeps times before the start or past the end inside the recording', () => {
    expect(locate(parts, -5)).toEqual({ index: 0, offset: 0 })
    expect(locate(parts, 9999)).toEqual({ index: 2, offset: 300 })
    expect(locate([], 10)).toEqual({ index: 0, offset: 0 })
  })
})

describe('transcript lines', () => {
  const lines = [{ start: 0, end: 4, text: 'Welcome to the lecture.' }, { start: 4, end: 9, text: 'Today: the Krebs cycle.' }, { start: 9, end: 12, text: 'It happens in the matrix.' }]
  it('finds the line being spoken at a time', () => {
    expect([0, 3.9, 4, 11, 50].map(t => lineAt(lines, t))).toEqual([0, 0, 1, 2, 2])
    expect(lineAt(lines, -1)).toBe(-1)
  })
  it('searches lines ignoring case', () => {
    expect(searchLines(lines, 'THE')).toEqual([0, 1, 2])
    expect(searchLines(lines, 'krebs')).toEqual([1])
    expect(searchLines(lines, '  ')).toEqual([])
  })
})

describe('storage', () => {
  it('warns from 80% of the 300 MB quota and blocks at 100%', () => {
    expect(AUDIO_QUOTA_BYTES).toBe(300 * 1024 * 1024)
    expect(storageState(0)).toBe('ok')
    expect(storageState(AUDIO_QUOTA_BYTES * 0.79)).toBe('ok')
    expect(storageState(AUDIO_QUOTA_BYTES * 0.8)).toBe('warn')
    expect(storageState(AUDIO_QUOTA_BYTES)).toBe('full')
    expect(formatMb(410 * 1024 * 1024)).toBe('410 MB')
  })
})

describe('partSeconds', () => {
  it('is 20 minutes, unless E2E shortens it', () => {
    expect(partSeconds()).toBe(1200)
    process.env.NEXT_PUBLIC_LECTURE_PART_SECONDS = '3'
    expect(partSeconds()).toBe(3)
    process.env.NEXT_PUBLIC_LECTURE_PART_SECONDS = 'nonsense'
    expect(partSeconds()).toBe(1200)
  })
})
