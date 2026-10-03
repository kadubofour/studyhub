import type { AnswerRecord, Question } from './types'

export const normalizeAnswer = (s: string) =>
  s.normalize('NFKC').toLowerCase().replace(/[.,;:!?'"`()]+/g, ' ').replace(/\s+/g, ' ').trim()

// true/false for questions marked on the spot; null = a short answer the AI needs to judge
export function markInstant(q: Question, given: string): boolean | null {
  const same = normalizeAnswer(given) === normalizeAnswer(q.answer)
  if (q.type === 'short') return same ? true : null
  return same
}

export const scoreOf = (answers: Record<string, AnswerRecord>) => Object.values(answers).filter(a => a.correct).length
