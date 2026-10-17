import type { Rating } from '../srs'

// Marks a typed flashcard answer against the card's back, with no AI and no cost. It is forgiving about capitals, spacing, punctuation, simple
// formatting marks and accents, and about a slip or two, but strict about numbers. It only suggests: the student chooses the rating.

export type Verdict = 'correct' | 'close' | 'different'
export interface AnswerCheck { verdict: Verdict; suggested: Rating }
export type ReviewMode = 'flip' | 'type'

export const parseReviewMode = (v: unknown): ReviewMode => (v === 'type' ? 'type' : 'flip')

const SUGGESTED: Record<Verdict, Rating> = { correct: 3, close: 2, different: 1 }

/** Lower case, no accents, no formatting marks or punctuation, single spaces */
export function normalise(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function distance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = row
  }
  return prev[b.length]
}

const numbers = (s: string) => (s.match(/\d+/g) ?? []).join(',')

export function checkAnswer(typed: string, back: string): AnswerCheck {
  const a = normalise(typed), b = normalise(back)
  const result = (verdict: Verdict): AnswerCheck => ({ verdict, suggested: SUGGESTED[verdict] })
  if (!a || !b) return result('different')
  if (a === b) return result('correct')
  if (numbers(a) !== numbers(b)) return result('different') // a wrong date or figure is wrong, however much else matches
  const allowed = b.length < 4 ? 0 : Math.ceil(b.length * 0.2)
  if (b.length <= 600 && a.length <= 600 && distance(a, b) <= allowed) return result('close')
  const wa = new Set(a.split(' ')), wb = new Set(b.split(' '))
  if (wb.size > 3) {
    const shared = [...wa].filter(w => wb.has(w)).length
    if (shared / (wa.size + wb.size - shared) >= 0.7) return result('close')
  }
  return result('different')
}
