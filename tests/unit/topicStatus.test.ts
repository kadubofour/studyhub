import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { MASTERED_MIN_ANSWERS, MASTERED_PERCENT, STATUS_LABEL, WEAK_MIN_ANSWERS, WEAK_PERCENT, WINDOW_DAYS, evidence, progressLine, weakSpots } from '@/lib/topics/status'
import type { TopicStat } from '@/lib/topics/types'

const stat = (over: Partial<TopicStat> = {}): TopicStat => ({
  topic_id: 't', name: 'Topic', position: 0, answers_30d: 0, correct_30d: 0, answers_all: 0, last_practised: null, notes: 0, lectures: 0, decks: 0, status: 'not_started', ...over,
})
const NOW = new Date('2026-10-20T12:00:00Z')
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString()

describe('thresholds', () => {
  it('match the numbers in the SQL', () => {
    const dir = 'supabase/migrations'
    const sql = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort().reverse()
      .map(f => fs.readFileSync(`${dir}/${f}`, 'utf8').replace(/\r\n/g, '\n')).find(s => /create (or replace )?function public\.topic_stats\(/.test(s))!
    const def = sql.slice(sql.search(/create (or replace )?function public\.topic_stats\(/))
    expect(def).toContain(`interval '${WINDOW_DAYS} days'`)
    expect(def).toContain(`>= ${MASTERED_MIN_ANSWERS} and coalesce(g.c30, 0) * 100 >= coalesce(g.a30, 0) * ${MASTERED_PERCENT}`)
    expect(def).toContain(`>= ${WEAK_MIN_ANSWERS} and coalesce(g.c30, 0) * 100 < coalesce(g.a30, 0) * ${WEAK_PERCENT}`)
  })
})

describe('evidence', () => {
  it('shows the numbers behind a status', () => {
    expect(evidence(stat({ answers_30d: 12, correct_30d: 8, answers_all: 20, status: 'weak' }))).toBe('12 answers, 67% right in the last 30 days')
    expect(evidence(stat({ answers_30d: 1, correct_30d: 1, answers_all: 1, status: 'covered' }))).toBe('1 answer, 100% right in the last 30 days')
    expect(evidence(stat({ answers_all: 4 }))).toBe('Not practised in the last 30 days')
    expect(evidence(stat())).toBe('Not practised yet')
  })
})

describe('weakSpots', () => {
  it('lists weak topics worst first, then covered topics not practised for 14 days, oldest first, at most 5', () => {
    const rows = [
      stat({ topic_id: 'ok', status: 'mastered', answers_30d: 12, correct_30d: 12, last_practised: daysAgo(30) }),
      stat({ topic_id: 'weak-b', status: 'weak', answers_30d: 10, correct_30d: 5, last_practised: daysAgo(1) }),
      stat({ topic_id: 'weak-a', status: 'weak', answers_30d: 10, correct_30d: 2, last_practised: daysAgo(1) }),
      stat({ topic_id: 'stale-new', status: 'covered', answers_all: 3, last_practised: daysAgo(15) }),
      stat({ topic_id: 'stale-old', status: 'covered', answers_all: 3, last_practised: daysAgo(40) }),
      stat({ topic_id: 'fresh', status: 'covered', answers_all: 3, last_practised: daysAgo(2) }),
      stat({ topic_id: 'never', status: 'not_started' }),
    ]
    expect(weakSpots(rows, NOW).map(r => r.topic_id)).toEqual(['weak-a', 'weak-b', 'stale-old', 'stale-new'])
    const many = Array.from({ length: 8 }, (_, i) => stat({ topic_id: `w${i}`, status: 'weak', answers_30d: 10, correct_30d: i }))
    expect(weakSpots(many, NOW)).toHaveLength(5)
  })
  it('is empty when nothing is weak or stale', () => {
    expect(weakSpots([stat(), stat({ status: 'mastered', answers_30d: 10, correct_30d: 10 })], NOW)).toEqual([])
  })
})

describe('progressLine and labels', () => {
  it('summarises a course', () => {
    const rows = [stat({ status: 'mastered' }), stat({ status: 'mastered' }), stat({ status: 'weak' }), stat({ status: 'covered' }), stat()]
    expect(progressLine(rows)).toBe('2 of 5 mastered · 1 weak · 1 covered')
    expect(progressLine([stat(), stat()])).toBe('0 of 2 mastered')
  })
  it('has a plain label for every status', () => {
    expect(STATUS_LABEL).toEqual({ not_started: 'Not started', covered: 'Covered', weak: 'Weak', mastered: 'Mastered' })
  })
})
