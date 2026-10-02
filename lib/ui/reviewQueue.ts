import type { Card } from '../types'
import type { Rating } from '../srs'

// Remove the rated card by id (never "whatever is at the head"), re-adding "Again" cards at the end.
export function advanceQueue(queue: Card[], rated: Card, updated: Card, rating: Rating): Card[] {
  const rest = queue.filter(c => c.id !== rated.id)
  return rating === 1 ? [...rest, updated] : rest
}

// Counts successful ratings per card so a stale Retry (from an earlier failed attempt) is ignored
// once the same card has been rated by a later press.
export class RatingLedger {
  private counts = new Map<string, number>()
  ticket(cardId: string): number { return this.counts.get(cardId) ?? 0 }
  isCurrent(cardId: string, ticket: number): boolean { return (this.counts.get(cardId) ?? 0) === ticket }
  recorded(cardId: string): void { this.counts.set(cardId, (this.counts.get(cardId) ?? 0) + 1) }
}
