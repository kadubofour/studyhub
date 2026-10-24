import { describe, it, expect } from 'vitest'
import { todayLine } from '@/lib/home/todayLine'

// The line under Home's greeting: today's one fact, set from the data
describe('todayLine', () => {
  it('says plainly when nothing is due', () => {
    expect(todayLine({ overdue: 0, dueToday: 0, reminders: 0 })).toBe('Nothing due today.')
  })
  it('counts the tasks due today', () => {
    expect(todayLine({ overdue: 0, dueToday: 1, reminders: 0 })).toBe('1 task due today.')
    expect(todayLine({ overdue: 0, dueToday: 3, reminders: 0 })).toBe('3 tasks due today.')
  })
  it('puts what is overdue first, since it needs doing first', () => {
    expect(todayLine({ overdue: 2, dueToday: 3, reminders: 0 })).toBe('2 overdue tasks and 3 due today.')
    expect(todayLine({ overdue: 1, dueToday: 0, reminders: 0 })).toBe('1 overdue task.')
  })
  it('adds the reminders still to come', () => {
    expect(todayLine({ overdue: 1, dueToday: 2, reminders: 1 })).toBe('1 overdue task, 2 due today and 1 reminder.')
    expect(todayLine({ overdue: 0, dueToday: 0, reminders: 2 })).toBe('2 reminders today.')
  })
})

describe('todayLine once the day is done', () => {
  it('says all is done, the same words as Today', () => {
    expect(todayLine({ overdue: 0, dueToday: 0, reminders: 0, done: 2 })).toBe('All done for today.')
  })
  it('still counts what is left when some is done', () => {
    expect(todayLine({ overdue: 0, dueToday: 1, reminders: 0, done: 2 })).toBe('1 task due today.')
  })
})
