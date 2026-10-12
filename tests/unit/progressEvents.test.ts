// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PROGRESS_CHANGED, announceProgressChanged } from '@/lib/xp/events'
import { setTaskDone } from '@/lib/data/tasks'
import { rateCard } from '@/lib/data/cards'
import { logFocusSession } from '@/lib/data/focus'
import { finishAttempt } from '@/lib/data/quizzes'
import { recordGamePlay } from '@/lib/data/games'
import { saveDaySessions } from '@/lib/plan/service'
import type { Card } from '@/lib/types'

const heard = vi.fn()
beforeEach(() => { heard.mockClear(); window.addEventListener(PROGRESS_CHANGED, heard) })
afterEach(() => { window.removeEventListener(PROGRESS_CHANGED, heard) })

const ok = { error: null }
const bad = { error: { message: 'x' } }
// A stand-in whose every query chain ends in `result`
function sb(result: unknown) {
  const q: Record<string, unknown> = {}
  for (const k of ['from', 'update', 'upsert', 'insert', 'eq', 'select', 'single', 'rpc']) q[k] = () => q
  q.then = (res: (v: unknown) => unknown) => res(result)
  return q as never
}
const card = { id: 'c1', deck_id: 'd', front: 'q', back: 'a', due_at: '2026-01-01T00:00:00Z', interval_days: 0, ease: 2.5, reps: 0, lapses: 0 } as Card

describe('announceProgressChanged', () => {
  it('tells the page that XP or due cards may have changed', () => {
    announceProgressChanged()
    expect(heard).toHaveBeenCalledTimes(1)
  })
})

describe('what earns XP says so once it is saved', () => {
  it('ticking a task', async () => { await setTaskDone(sb(ok), 't', true); expect(heard).toHaveBeenCalledTimes(1) })
  it('rating a card', async () => { await rateCard(sb({ data: card, error: null }), card, 3, new Date()); expect(heard).toHaveBeenCalledTimes(1) })
  it('a focus session', async () => { await logFocusSession(sb(ok), { startedAt: new Date(), endedAt: new Date(), minutes: 25, completed: true }); expect(heard).toHaveBeenCalledTimes(1) })
  it('finishing a quiz', async () => { await finishAttempt(sb({ data: { id: 'a' }, error: null }), 'a', {}, 1); expect(heard).toHaveBeenCalledTimes(1) })
  it('a game', async () => { await recordGamePlay(sb(ok), { deckId: 'd', game: 'speed', score: 1, total: 4 }); expect(heard).toHaveBeenCalledTimes(1) })
  it('a study plan session', async () => { await saveDaySessions(sb(ok), 'day', []); expect(heard).toHaveBeenCalledTimes(1) })
})

describe('nothing is announced when the save failed', () => {
  it.each([
    ['task', () => setTaskDone(sb(bad), 't', true)],
    ['card', () => rateCard(sb({ data: null, error: { message: 'x' } }), card, 3, new Date())],
    ['focus', () => logFocusSession(sb(bad), { startedAt: new Date(), endedAt: new Date(), minutes: 25, completed: true })],
    ['quiz', () => finishAttempt(sb({ data: null, error: { message: 'x' } }), 'a', {}, 1)],
    ['game', () => recordGamePlay(sb(bad), { deckId: 'd', game: 'speed', score: 1, total: 4 })],
    ['plan', () => saveDaySessions(sb(bad), 'day', [])],
  ])('%s', async (_n, run) => {
    await expect(run()).rejects.toBeTruthy()
    expect(heard).not.toHaveBeenCalled()
  })
})
