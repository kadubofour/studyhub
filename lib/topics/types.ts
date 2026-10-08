export type TopicStatus = 'not_started' | 'covered' | 'weak' | 'mastered'
export type TopicLink = { kind: 'note' | 'lecture' | 'deck'; id: string }
export type TopicDraft = { id?: string; name: string; links: TopicLink[] }
// A topic as the drafting AI returns it: the ids of the notes and lectures that cover it
export type DraftTopic = { name: string; notes: string[]; lectures: string[] }
export type CourseMaterial = {
  notes: { id: string; title: string }[]
  lectures: { id: string; title: string }[]
  decks: { id: string; name: string }[]
}
// One row of the topic_stats database function
export type TopicStat = {
  topic_id: string; name: string; position: number
  answers_30d: number; correct_30d: number; answers_all: number; last_practised: string | null
  notes: number; lectures: number; decks: number; status: TopicStatus
}
