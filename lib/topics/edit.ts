import type { DraftTopic, TopicDraft, TopicLink, TopicStat } from './types'
import { MAX_TOPICS } from './validate'

const same = (a: TopicLink, b: TopicLink) => a.kind === b.kind && a.id === b.id
const union = (a: TopicLink[], b: TopicLink[]) => [...a, ...b.filter(l => !a.some(x => same(x, l)))]
const aiLinks = (t: DraftTopic): TopicLink[] => [
  ...t.notes.map(id => ({ kind: 'note' as const, id })),
  ...t.lectures.map(id => ({ kind: 'lecture' as const, id })),
]

// The saved topics, in order, with their links
export function toDrafts(stats: TopicStat[], links: { topic_id: string; link: TopicLink }[]): TopicDraft[] {
  return [...stats].sort((a, b) => a.position - b.position)
    .map(s => ({ id: s.topic_id, name: s.name, links: links.filter(l => l.topic_id === s.topic_id).map(l => l.link) }))
}

export const fromAi = (topics: DraftTopic[]): TopicDraft[] => topics.map(t => ({ name: t.name, links: aiLinks(t) }))

// Adds what an update found: links go to the existing topic of the same name, anything else becomes a new topic
export function applyUpdate(list: TopicDraft[], topics: DraftTopic[]): TopicDraft[] {
  let out = list.map(t => ({ ...t, links: [...t.links] }))
  for (const t of topics) {
    const key = t.name.trim().toLowerCase()
    const at = out.findIndex(x => x.name.trim().toLowerCase() === key)
    if (at >= 0) out[at] = { ...out[at], links: union(out[at].links, aiLinks(t)) }
    else if (out.length < MAX_TOPICS) out = [...out, { name: t.name, links: aiLinks(t) }]
  }
  return out
}

export const renameTopic = (list: TopicDraft[], i: number, name: string) => list.map((t, j) => (j === i ? { ...t, name } : t))
export const addTopic = (list: TopicDraft[], name: string): TopicDraft[] => [...list, { name, links: [] }]
export const removeTopic = (list: TopicDraft[], i: number) => list.filter((_, j) => j !== i)
export function moveTopic(list: TopicDraft[], i: number, dir: -1 | 1): TopicDraft[] {
  const to = i + dir
  if (to < 0 || to >= list.length) return list
  const out = [...list]
  ;[out[i], out[to]] = [out[to], out[i]]
  return out
}
// `from` goes away; `into` keeps its id and gets both topics' links
export function mergeTopics(list: TopicDraft[], from: number, into: number): TopicDraft[] {
  if (from === into) return list
  return list.flatMap((t, j) => (j === from ? [] : j === into ? [{ ...t, links: union(t.links, list[from].links) }] : [t]))
}
export const addLink = (list: TopicDraft[], i: number, link: TopicLink) =>
  list.map((t, j) => (j === i ? { ...t, links: union(t.links, [link]) } : t))
export const removeLink = (list: TopicDraft[], i: number, link: TopicLink) =>
  list.map((t, j) => (j === i ? { ...t, links: t.links.filter(l => !same(l, link)) } : t))
export const tidy = (list: TopicDraft[]) => list.map(t => ({ ...t, name: t.name.trim() }))
