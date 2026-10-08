import type { TopicStatus } from '@/lib/topics/types'

export type PlanMode = 'sprint' | 'balanced' | 'deep'
export type SessionKind = 'warmup' | 'learn' | 'revise'

// One topic as the scheduler sees it: its status and numbers (from topic_stats), whether a Warm-up quiz can be made
// (it has a linked note), and what the saved plan days say was done
export type PlanTopic = {
  id: string; name: string; position: number; status: TopicStatus
  percent: number | null          // % right in the last 30 days; null with no answers
  lastPractised: string | null    // ISO time of the last answer
  hasNote: boolean
  learned: boolean; warmedUp: boolean
  lastStudied: string | null      // day key of the last session done for it
}
export type PlanSession = { topicId: string; kind: SessionKind; minutes: number }
export type DayPlan = { day: string; sessions: PlanSession[] }
// A session as saved in a day's list
export type StoredSession = { id: string; topic_id: string; kind: SessionKind; minutes: number; done_at: string | null }
