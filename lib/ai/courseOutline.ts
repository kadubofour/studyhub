import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { stripImagesForAi } from '@/lib/notes/images'
import { stripMarkupForAi } from '@/lib/notes/markup'

// What the student has in a course, for a chat about it: every note, lecture and file by name, the course's topics in order (with what covers each
// and how the student is doing on it), and the opening of the newest notes, so the tutor always knows what the course holds and what to teach next. Read with the student's own session. The tutor works
// without it, so a failure gives nothing rather than an error.
export const OUTLINE_LIMITS = { names: 40, opened: 3, opening: 1500, total: 6000, topics: 20, covers: 4 }

const STATUS: Record<string, string> = { not_started: 'not started', covered: 'covered', weak: 'weak', mastered: 'mastered' }
type TopicRow = { topic_id: string; name: string; position: number; answers_30d: number; correct_30d: number; status: string }
type LinkRow = { topic_id: string; note_id: string | null; lecture_id: string | null }

const clean = (s: string) => s.replace(/\s+/g, ' ').replace(/</g, '‹').trim()

const percent = (t: TopicRow) => Math.round((t.correct_30d / t.answers_30d) * 100)

// "Topics in the order to teach them": each with the notes and lectures that cover it and how the student is doing on it
function topicLines(stats: unknown, links: unknown, notes: { id: string; title: string }[], lectures: { id: string; title: string }[]): string[] {
  const rows = (Array.isArray(stats) ? stats as TopicRow[] : []).filter(t => t && typeof t.name === 'string').sort((a, b) => a.position - b.position).slice(0, OUTLINE_LIMITS.topics)
  if (!rows.length) return []
  const title = new Map<string, string>([...notes.map(x => [x.id, x.title] as const), ...lectures.map(x => [x.id, x.title] as const)])
  const covers = new Map<string, string[]>()
  for (const k of Array.isArray(links) ? links as LinkRow[] : []) {
    const t = title.get(k.note_id ?? k.lecture_id ?? '')
    if (t) covers.set(k.topic_id, [...(covers.get(k.topic_id) ?? []), clean(t).slice(0, 60)])
  }
  return ['Topics, in the order to teach them:', ...rows.map((t, i) => {
    const doing = t.answers_30d > 0 ? `${STATUS[t.status] ?? t.status}, ${percent(t)}% right in the last 30 days` : STATUS[t.status] ?? t.status
    const by = (covers.get(t.topic_id) ?? []).slice(0, OUTLINE_LIMITS.covers)
    return `${i + 1}. ${clean(t.name).slice(0, 80)} (${doing})${by.length ? ` - covered by: ${by.join('; ')}` : ''}`
  })]
}

export async function courseOutline(sb: SupabaseClient, course: { id: string; name: string }): Promise<string> {
  try {
    const [notes, lectures, files, stats, links] = await Promise.all([
      sb.from('notes').select('id,title,content_md,updated_at').eq('course_id', course.id).order('updated_at', { ascending: false }).limit(OUTLINE_LIMITS.names),
      sb.from('lectures').select('id,title,recorded_at').eq('course_id', course.id).order('recorded_at', { ascending: false }).limit(OUTLINE_LIMITS.names),
      sb.from('materials').select('id,name').eq('course_id', course.id).order('created_at', { ascending: false }).limit(OUTLINE_LIMITS.names),
      // the topics are the student's own plan of the course; a course with none, or a failed read, simply has no such part
      Promise.resolve(sb.rpc('topic_stats', { p_course: course.id })).then(r => r, () => ({ data: null })),
      Promise.resolve(sb.from('topic_links').select('topic_id,note_id,lecture_id,topics!inner(course_id)').eq('topics.course_id', course.id)).then(r => r, () => ({ data: null })),
    ])
    const n = (notes.data ?? []) as { id: string; title: string; content_md: string }[]
    const l = (lectures.data ?? []) as { id: string; title: string }[]
    const f = (files.data ?? []) as { id: string; name: string }[]
    if (!n.length && !l.length && !f.length) return ''
    const names = (kind: string, rows: { id: string; title?: string; name?: string }[]) => rows.map(r => `- ${kind} ${r.id}: ${clean(r.title ?? r.name ?? '').slice(0, 120)}`)
    const lines = [`Course: ${clean(course.name).slice(0, 120)}`, ...names('note', n), ...names('lecture', l), ...names('file', f), ...topicLines(stats.data, links.data, n, l)]
    let used = lines.join('\n').length
    const opened: string[] = []
    for (const note of n.slice(0, OUTLINE_LIMITS.opened)) {
      const text = stripMarkupForAi(stripImagesForAi(note.content_md ?? '')).trim().slice(0, Math.min(OUTLINE_LIMITS.opening, Math.max(0, OUTLINE_LIMITS.total - used)))
      if (!text) continue
      opened.push(`Start of the note "${clean(note.title).slice(0, 120)}":\n${text}`)
      used += text.length
    }
    return `<course_outline>\n${[...lines, ...opened].join('\n')}\n</course_outline>`
  } catch { return '' }
}
