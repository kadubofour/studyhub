import type { SupabaseClient } from '@supabase/supabase-js'
import type { CourseMaterial, TopicDraft, TopicLink, TopicStat } from '@/lib/topics/types'
import { check, must } from './util'

export async function listTopicStats(sb: SupabaseClient, courseId: string): Promise<TopicStat[]> {
  return must(await sb.rpc('topic_stats', { p_course: courseId })) ?? []
}

export async function listTopicLinks(sb: SupabaseClient, courseId: string): Promise<{ topic_id: string; link: TopicLink }[]> {
  const rows = must(await sb.from('topic_links').select('topic_id,note_id,lecture_id,deck_id,topics!inner(course_id)').eq('topics.course_id', courseId)) as
    { topic_id: string; note_id: string | null; lecture_id: string | null; deck_id: string | null }[]
  return rows.map(r => ({
    topic_id: r.topic_id,
    link: r.note_id ? { kind: 'note', id: r.note_id } : r.lecture_id ? { kind: 'lecture', id: r.lecture_id } : { kind: 'deck', id: r.deck_id! },
  }))
}

export async function listCourseMaterial(sb: SupabaseClient, courseId: string): Promise<CourseMaterial> {
  const [notes, lectures, decks] = await Promise.all([
    sb.from('notes').select('id,title').eq('course_id', courseId).order('title'),
    sb.from('lectures').select('id,title').eq('course_id', courseId).order('title'),
    sb.from('decks').select('id,name').eq('course_id', courseId).order('name'),
  ])
  return { notes: must(notes) ?? [], lectures: must(lectures) ?? [], decks: must(decks) ?? [] }
}

// Saves the whole edited list at once: all of it or none of it
export async function saveCourseTopics(sb: SupabaseClient, courseId: string, topics: TopicDraft[]): Promise<void> {
  check(await sb.rpc('save_course_topics', {
    p_course: courseId,
    p_topics: topics.map(t => ({ ...(t.id ? { id: t.id } : {}), name: t.name, links: t.links })),
  }))
}
