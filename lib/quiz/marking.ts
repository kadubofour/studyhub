import type { AnswerRecord, Question } from './types'

export const normalizeAnswer = (s: string) =>
  s.normalize('NFKC').toLowerCase().replace(/[.,;:!?'"`()]+/g, ' ').replace(/\s+/g, ' ').trim()

// true/false for questions marked on the spot; null = a short answer the AI needs to judge
export function markInstant(q: Question, given: string): boolean | null {
  // Typed answers are forgiving about punctuation; picked options must match exactly, since two
  // options can differ only by punctuation, e.g. f(x) and f'(x)
  if (q.type === 'short') return normalizeAnswer(given) === normalizeAnswer(q.answer) ? true : null
  return given.trim().toLowerCase() === q.answer.trim().toLowerCase()
}

export const scoreOf = (answers: Record<string, AnswerRecord>) => Object.values(answers).filter(a => a.correct).length
