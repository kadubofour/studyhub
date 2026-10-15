import type { Question, Quiz, QuizAttempt } from './types'

/** The badge on an answer tile: A to D, then numbers if a quiz ever has more */
export const optionLetter = (i: number) => 'ABCDEFGH'[i] ?? String(i + 1)

export const percent = (correct: number, total: number) => (total > 0 ? Math.round((correct / total) * 100) : 0)

/** A line that matches how the quiz went */
export function scoreLine(correct: number, total: number): string {
  const p = percent(correct, total)
  if (total === 0) return 'Quiz finished'
  if (p === 100) return 'Perfect score'
  if (p >= 80) return 'Great work'
  if (p >= 60) return 'Good effort'
  if (p >= 40) return 'Getting there'
  return 'Keep going'
}

/** How a progress ring of this radius is drawn: its full length, and how much of it to leave empty */
export function ringDash(pct: number, radius: number) {
  const circumference = 2 * Math.PI * radius
  return { circumference, offset: circumference * (1 - Math.max(0, Math.min(100, pct)) / 100) }
}

/** The questions an attempt got wrong, or left unanswered, in quiz order */
export const missedQuestions = (quiz: Quiz, attempt: Pick<QuizAttempt, 'answers'>): Question[] => quiz.questions.filter(q => !attempt.answers[q.id]?.correct)

/** The answer shown to a student: True/False spelled out, anything else as written */
export const answerText = (q: Question, value: string) => (q.type === 'true_false' ? (value.toLowerCase() === 'true' ? 'True' : 'False') : value)
