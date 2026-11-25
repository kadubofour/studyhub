export type TopicStatus = 'not_started' | 'covered' | 'weak' | 'mastered'
export type TopicLink = { kind: 'note' | 'lecture' | 'deck' | 'file'; id: string }
export type TopicDraft = { id?: string; name: string; links: TopicLink[] }
// A topic as the drafting AI returns it: the ids of the notes, lectures and uploaded files that cover it
export type DraftTopic = { name: string; notes: string[]; lectures: string[]; files?: string[] }
export type CourseMaterial = {
  notes: { id: string; title: string }[]
  lectures: { id: string; title: string }[]
  decks: { id: string; name: string }[]
  // uploaded files with no note made from them (one that has a note is covered by the note)
  files: { id: string; name: string }[]
}
// One row of the topic_stats database function
export type TopicStat = {
  topic_id: string; name: string; position: number
  answers_30d: number; correct_30d: number; answers_all: number; last_practised: string | null
  notes: number; lectures: number; decks: number; status: TopicStatus
  files?: number
}
