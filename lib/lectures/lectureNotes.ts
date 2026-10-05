'use client'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createNote } from '@/lib/data/notes'
import { updateLecture, type Lecture } from '@/lib/data/lectures'
import { postAi } from '@/components/ai/aiFetch'
import { transcriptToNote } from './transcriptNote'

type LectureForNote = Pick<Lecture, 'id' | 'title' | 'course_id' | 'transcript'>

// Saves the note in the lecture's course and links it to the lecture; returns the note's id
async function saveLinked(sb: SupabaseClient, lecture: LectureForNote, note: { title: string; content_md: string }): Promise<string> {
  const n = await createNote(sb, { ...note, course_id: lecture.course_id })
  await updateLecture(sb, lecture.id, { note_id: n.id })
  return n.id
}

// The transcript as it is, paragraphed: free, no AI actions
export const makeFreeNote = (sb: SupabaseClient, lecture: LectureForNote) =>
  saveLinked(sb, lecture, transcriptToNote(lecture.title, lecture.transcript))

// A structured study note written by AI from the transcript (2 AI actions)
export async function makeAiNote(sb: SupabaseClient, lecture: LectureForNote): Promise<{ ok: true; noteId: string } | { ok: false; code: string; message: string }> {
  const r = await postAi<{ title: string; content_md: string }>('/api/ai/lecture-note', { lectureId: lecture.id })
  if (!r.ok) return { ok: false, code: r.error, message: r.message }
  return { ok: true, noteId: await saveLinked(sb, lecture, { title: r.value.title, content_md: r.value.content_md }) }
}
