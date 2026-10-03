// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { quizScoresByCourse } from '@/lib/stats'

const row = (course_id: string | null, correct: number, at: string) => ({ correct, total: 10, finished_at: at, quiz_title: 'Q', course_id })

vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({}) }))
vi.mock('@/lib/data/quizzes', () => ({ listFinishedAttemptsSince: async () => [row('c1', 5, '2026-10-01T10:00:00Z'), row('c1', 7, '2026-10-02T10:00:00Z')] }))
vi.mock('@/lib/data/courses', () => ({ listCourses: async () => [{ id: 'c1', name: 'Biology', color: '#3B5BDB' }] }))
import { QuizScores } from '@/components/progress/QuizScores'

afterEach(cleanup)

describe('quizScoresByCourse', () => {
  it('groups by course, oldest first, as percentages, keeping the last 10', () => {
    const rows = [row('c1', 7, '2026-10-02T00:00:00Z'), row('c1', 5, '2026-10-01T00:00:00Z'), row(null, 10, '2026-10-01T00:00:00Z'),
      ...Array.from({ length: 11 }, (_, i) => row('c2', i, `2026-09-${String(i + 1).padStart(2, '0')}T00:00:00Z`))]
    const out = quizScoresByCourse(rows)
    expect(out.find(c => c.course_id === 'c1')!.scores.map(s => s.percent)).toEqual([50, 70])
    expect(out.find(c => c.course_id === null)!.scores).toHaveLength(1)
    expect(out.find(c => c.course_id === 'c2')!.scores).toHaveLength(10)
    expect(out.find(c => c.course_id === 'c2')!.scores[0].percent).toBe(10)
  })
})

describe('QuizScores', () => {
  it('shows each course\'s recent quiz scores', async () => {
    render(<QuizScores />)
    expect(await screen.findByText('Biology')).toBeTruthy()
    expect(screen.getByLabelText('Biology quiz scores: 50%, 70%')).toBeTruthy()
  })
})
