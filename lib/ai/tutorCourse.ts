import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { stripImagesForAi } from '@/lib/notes/images'
import { stripMarkupForAi } from '@/lib/notes/markup'
import type { TranscriptLine } from '@/lib/lectures/time'
import { transcriptText } from './lectureNote'
import type { Material } from './tutorContext'

// Everything uploaded for a course, for a chat about it: its notes, lecture transcripts and files, whether filed under the course or in one of its notebooks.
// Read with the student's own session. The tutor works without it, so a failure gives nothing rather than an error.
export async function courseMaterial(sb: SupabaseClient, courseId: string, notebookIds: string[]): Promise<Material[]> {
  try {
    const scope = `course_id.eq.${courseId}${notebookIds.length ? `,notebook_id.in.(${notebookIds.join(',')})` : ''}`
    const [notes, lectures, files] = await Promise.all([
      sb.from('notes').select('id,title,content_md').or(scope).limit(200),
      sb.from('lectures').select('id,title,transcript').or(scope).limit(100),
      sb.from('materials').select('id,name,body,note_id').or(scope).eq('body_status', 'ready').limit(100),
    ])
    const n = (notes.data ?? []) as { id: string; title: string; content_md: string }[]
    const l = (lectures.data ?? []) as { id: string; title: string; transcript: TranscriptLine[] | null }[]
    const f = (files.data ?? []) as { id: string; name: string; body: string | null; note_id: string | null }[]
    const noted = new Set(n.map(x => x.id)) // a file a note was made from says the same as the note
    return [
      ...n.map(x => ({ kind: 'note' as const, id: x.id, title: x.title, text: stripMarkupForAi(stripImagesForAi(x.content_md ?? '')) })),
      ...l.map(x => ({ kind: 'lecture' as const, id: x.id, title: x.title, text: transcriptText(x.transcript ?? []) })),
      ...f.filter(x => !x.note_id || !noted.has(x.note_id)).map(x => ({ kind: 'file' as const, id: x.id, title: x.name, text: x.body ?? '' })),
    ]
  } catch { return [] }
}
