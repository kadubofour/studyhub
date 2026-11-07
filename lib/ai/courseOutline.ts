import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { stripImagesForAi } from '@/lib/notes/images'
import { stripMarkupForAi } from '@/lib/notes/markup'

// What the student has in a course, for a chat about it: every note, lecture and file by name, and the opening of the newest notes, so the tutor
// always knows what the course holds and can teach from it, whatever the message says. Read with the student's own session. The tutor works
// without it, so a failure gives nothing rather than an error.
export const OUTLINE_LIMITS = { names: 40, opened: 3, opening: 1500, total: 6000 }

const clean = (s: string) => s.replace(/\s+/g, ' ').replace(/</g, '‹').trim()

export async function courseOutline(sb: SupabaseClient, course: { id: string; name: string }): Promise<string> {
  try {
    const [notes, lectures, files] = await Promise.all([
      sb.from('notes').select('id,title,content_md,updated_at').eq('course_id', course.id).order('updated_at', { ascending: false }).limit(OUTLINE_LIMITS.names),
      sb.from('lectures').select('id,title,recorded_at').eq('course_id', course.id).order('recorded_at', { ascending: false }).limit(OUTLINE_LIMITS.names),
      sb.from('materials').select('id,name').eq('course_id', course.id).order('created_at', { ascending: false }).limit(OUTLINE_LIMITS.names),
    ])
    const n = (notes.data ?? []) as { id: string; title: string; content_md: string }[]
    const l = (lectures.data ?? []) as { id: string; title: string }[]
    const f = (files.data ?? []) as { id: string; name: string }[]
    if (!n.length && !l.length && !f.length) return ''
    const names = (kind: string, rows: { id: string; title?: string; name?: string }[]) => rows.map(r => `- ${kind} ${r.id}: ${clean(r.title ?? r.name ?? '').slice(0, 120)}`)
    const lines = [`Course: ${clean(course.name).slice(0, 120)}`, ...names('note', n), ...names('lecture', l), ...names('file', f)]
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
