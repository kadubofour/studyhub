import type { Rating } from '../srs'

// Marks a typed flashcard answer against the card's back, with no AI and no cost. It is forgiving about capitals, spacing, punctuation, simple
// formatting marks and accents, and about a slip in a word, but strict about numbers, signs and opposites. It only suggests: the student chooses the rating.

export type Verdict = 'correct' | 'close' | 'different'
export interface AnswerCheck { verdict: Verdict; suggested: Rating }
export type ReviewMode = 'flip' | 'type'

export const parseReviewMode = (v: unknown): ReviewMode => (v === 'type' ? 'type' : 'flip')

const SUGGESTED: Record<Verdict, Rating> = { correct: 3, close: 2, different: 1 }

// Stand-ins that keep a decimal point, a minus sign and a caret through the clean-up below
const DOT = '\u0001', MINUS = '\u0002', CARET = '\u0003'

/** Lower case, no accents, no formatting marks or punctuation, single spaces. Letters of any alphabet and digits stay (sub and superscripts become plain
 *  digits), as do a minus sign before a number, a caret, and a decimal point between digits: dropping them would make -3 the same as 3. */
export function normalise(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/n['’]t\b/g, ' not')
    .replace(/[−–]/g, '-')
    .replace(/(\d)\.(?=\d)/g, `$1${DOT}`)
    .replace(/(^|[\s^(])-(?=\d)/g, `$1${MINUS}`)
    .replace(/\^/g, CARET)
    .replace(/[^\p{L}\p{N}\s\u0001\u0002\u0003]/gu, ' ')
    .replace(/\s+/g, ' ').trim()
    .replaceAll(DOT, '.').replaceAll(MINUS, '-').replaceAll(CARET, '^')
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

/** How many words the two share, in the same order */
function sharedInOrder(a: string[], b: string[]): number {
  let prev: number[] = new Array(b.length + 1).fill(0)
  for (let i = 1; i <= a.length; i++) {
    const row = [0]
    for (let j = 1; j <= b.length; j++) row[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], row[j - 1])
    prev = row
  }
  return prev[b.length]
}

const numbers = (s: string) => (s.match(/-?\d+(\.\d+)?/g) ?? []).join(',')
const negated = (s: string) => /\b(not|no|never|non|without|cannot)\b/.test(s)

export function checkAnswer(typed: string, back: string): AnswerCheck {
  const a = normalise(typed), b = normalise(back)
  const result = (verdict: Verdict): AnswerCheck => ({ verdict, suggested: SUGGESTED[verdict] })
  if (!a || !b) return result('different')
  if (a === b) return result('correct')
  if (numbers(a) !== numbers(b)) return result('different') // a wrong date, figure or sign is wrong, however much else matches
  if (negated(a) !== negated(b)) return result('different') // "does" and "does not" are opposites, not a slip
  const wa = a.split(' '), wb = b.split(' ')
  // A letter or symbol that differs (α for β, A for B) is a different answer, not a slip
  if (wa.length === wb.length && wa.some((w, i) => w !== wb[i] && (w.length < 2 || wb[i].length < 2))) return result('different')
  // A slip or two in a word is fine; text with figures in it (units, exponents) gets no such leniency
  const allowed = numbers(b) || b.length < 4 ? 0 : b.length <= 10 ? 1 : 2
  if (b.length <= 600 && a.length <= 600 && distance(a, b) <= allowed) return result('close')
  if (wb.length > 3 && sharedInOrder(wa, wb) / Math.max(wa.length, wb.length) >= 0.7) return result('close')
  return result('different')
}
