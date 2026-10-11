export type GCard = { id: string; front: string; back: string }
export type Question = { card: GCard; options: string[]; answer: string }
type Rng = () => number

export const MIN_CARDS = 4
const MATCH_PAIRS = 6
const SPEED_QUESTIONS = 10
const norm = (s: string) => s.trim().toLowerCase()

export function shuffle<T>(xs: T[], rng: Rng = Math.random): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

// Cards for Match: random, each front and back used once so a pair can only be matched one way
export function buildMatch(cards: GCard[], rng: Rng = Math.random): GCard[] {
  const fronts = new Set<string>(), backs = new Set<string>(), out: GCard[] = []
  for (const c of shuffle(cards, rng)) {
    if (out.length === MATCH_PAIRS) break
    if (fronts.has(norm(c.front)) || backs.has(norm(c.back))) continue
    fronts.add(norm(c.front)); backs.add(norm(c.back)); out.push(c)
  }
  return out
}

// Questions for Speed round: a front, and four different backs. A card the deck cannot give three other answers for is skipped.
export function buildSpeed(cards: GCard[], rng: Rng = Math.random): Question[] {
  const out: Question[] = []
  for (const card of shuffle(cards, rng)) {
    if (out.length === SPEED_QUESTIONS) break
    const seen = new Set([norm(card.back)])
    const wrong: string[] = []
    for (const o of shuffle(cards, rng)) {
      if (wrong.length === 3) break
      if (seen.has(norm(o.back)) || norm(o.front) === norm(card.front)) continue // a card with the same front may be a right answer too
      seen.add(norm(o.back)); wrong.push(o.back)
    }
    if (wrong.length < 3) continue
    out.push({ card, answer: card.back, options: shuffle([card.back, ...wrong], rng) })
  }
  return out
}
