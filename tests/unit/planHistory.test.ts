import { describe, it, expect } from 'vitest'
import { summariseHistory, toPlanTopics } from '@/lib/plan/history'
import type { TopicStat } from '@/lib/topics/types'

const stat = (over: Partial<TopicStat> = {}): TopicStat => ({
  topic_id: 't1', name: 'Krebs', position: 1, answers_30d: 0, correct_30d: 0, answers_all: 0, last_practised: null, notes: 0, lectures: 0, decks: 0, status: 'not_started', ...over,
})

describe('summariseHistory', () => {
  it('says what was done for each topic and when it was last studied', () => {
    const h = summariseHistory([
      { topicId: 't1', kind: 'warmup', day: '2026-10-10' }, { topicId: 't1', kind: 'learn', day: '2026-10-11' },
      { topicId: 't1', kind: 'revise', day: '2026-10-09' }, { topicId: 't2', kind: 'revise', day: '2026-10-08' },
    ])
    expect(h.get('t1')).toEqual({ learned: true, warmedUp: true, lastStudied: '2026-10-11' })
    expect(h.get('t2')).toEqual({ learned: false, warmedUp: false, lastStudied: '2026-10-08' })
    expect(h.get('t3')).toBeUndefined()
  })
})

describe('toPlanTopics', () => {
  it('turns the stats into scheduler topics with the history', () => {
    const history = summariseHistory([{ topicId: 't1', kind: 'learn', day: '2026-10-11' }])
    const [t] = toPlanTopics([stat({ answers_30d: 8, correct_30d: 6, last_practised: '2026-10-05T10:00:00Z', status: 'covered' })], new Set(['t1']), history)
    expect(t).toEqual({
      id: 't1', name: 'Krebs', position: 1, status: 'covered', percent: 75, lastPractised: '2026-10-05T10:00:00Z',
      hasNote: true, learned: true, warmedUp: false, lastStudied: '2026-10-11',
    })
  })
  it('has no percent without answers, and no note unless one is linked', () => {
    const [t] = toPlanTopics([stat()], new Set(), new Map())
    expect(t).toMatchObject({ percent: null, hasNote: false, learned: false, warmedUp: false, lastStudied: null })
  })
})
