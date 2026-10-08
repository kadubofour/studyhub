import type { TopicStat } from '@/lib/topics/types'
import type { PlanTopic, SessionKind } from './types'

export type DoneSession = { topicId: string; kind: SessionKind; day: string }
export type History = Map<string, { learned: boolean; warmedUp: boolean; lastStudied: string | null }>

// What the saved days say was done: doing a Learn does not change a topic's status, so this is how the plan
// knows not to give it again
export function summariseHistory(done: DoneSession[]): History {
  const out: History = new Map()
  for (const d of done) {
    const h = out.get(d.topicId) ?? { learned: false, warmedUp: false, lastStudied: null }
    if (d.kind === 'learn') h.learned = true
    if (d.kind === 'warmup') h.warmedUp = true
    if (!h.lastStudied || d.day > h.lastStudied) h.lastStudied = d.day
    out.set(d.topicId, h)
  }
  return out
}

export function toPlanTopics(stats: TopicStat[], noteTopicIds: Set<string>, history: History): PlanTopic[] {
  return stats.map(s => {
    const h = history.get(s.topic_id)
    return {
      id: s.topic_id, name: s.name, position: s.position, status: s.status,
      percent: s.answers_30d ? Math.round((s.correct_30d / s.answers_30d) * 100) : null,
      lastPractised: s.last_practised, hasNote: noteTopicIds.has(s.topic_id),
      learned: h?.learned ?? false, warmedUp: h?.warmedUp ?? false, lastStudied: h?.lastStudied ?? null,
    }
  })
}
