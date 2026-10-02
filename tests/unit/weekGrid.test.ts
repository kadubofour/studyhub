import { describe, it, expect } from 'vitest'
import { gridHours } from '@/lib/timetable'

const c = (start_time: string, end_time: string) => ({ start_time, end_time })

describe('gridHours', () => {
  it('defaults to 07:00–21:00', () => {
    expect(gridHours([])).toEqual({ start: 7, end: 21 })
  })
  it('extends earlier for a 06:00 class and later for a class ending 22:30', () => {
    expect(gridHours([c('06:00:00', '07:00:00'), c('21:00:00', '22:30:00')])).toEqual({ start: 6, end: 23 })
  })
})
