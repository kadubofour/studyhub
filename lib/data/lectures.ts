import type { SupabaseClient } from '@supabase/supabase-js'
import type { AudioMime, LecturePart, TranscriptLine } from '@/lib/lectures/time'
import { check, must } from './util'

export type TranscriptStatus = 'none' | 'live' | 'processing' | 'done' | 'failed'
export type Lecture = {
  id: string; course_id: string | null; title: string; recorded_at: string; duration_seconds: number; audio_bytes: number
  mime: AudioMime; parts: LecturePart[]; transcript: TranscriptLine[]; transcript_status: TranscriptStatus
  transcript_source: 'browser' | 'openai' | null; note_id: string | null
}
export type LectureSummary = Pick<Lecture, 'id' | 'course_id' | 'title' | 'recorded_at' | 'duration_seconds' | 'transcript_status' | 'transcript_source' | 'audio_bytes'>

const COLS = 'id,course_id,title,recorded_at,duration_seconds,audio_bytes,mime,parts,transcript,transcript_status,transcript_source,note_id'

export async function listLectures(sb: SupabaseClient): Promise<LectureSummary[]> {
  return must(await sb.from('lectures').select('id,course_id,title,recorded_at,duration_seconds,transcript_status,transcript_source,audio_bytes').order('recorded_at', { ascending: false }))
}

export async function getLecture(sb: SupabaseClient, id: string): Promise<Lecture> {
  return must(await sb.from('lectures').select(COLS).eq('id', id).single())
}

export async function updateLecture(sb: SupabaseClient, id: string, patch: Partial<Pick<Lecture, 'title' | 'course_id' | 'note_id' | 'transcript_status' | 'transcript'>>): Promise<void> {
  check(await sb.from('lectures').update(patch).eq('id', id))
}

// The audio first (so nothing is left behind if that fails), then the row
export async function deleteLecture(sb: SupabaseClient, lecture: { id: string; parts: LecturePart[] }): Promise<void> {
  if (lecture.parts.length) {
    const { error } = await sb.storage.from('lectures').remove(lecture.parts.map(p => p.path))
    if (error) throw error
  }
  check(await sb.from('lectures').delete().eq('id', lecture.id))
}

// The real size of the student's audio files, counted by the server (the same figure storage
// uses to stop uploads at the 300 MB limit)
export async function audioUsed(sb: SupabaseClient): Promise<number> {
  const { data, error } = await sb.rpc('lecture_audio_bytes')
  if (error) throw error
  return Number(data ?? 0)
}

// Private audio: playable links that last a day, long enough for any listening session
export async function partUrls(sb: SupabaseClient, parts: LecturePart[]): Promise<string[]> {
  if (!parts.length) return []
  const { data, error } = await sb.storage.from('lectures').createSignedUrls(parts.map(p => p.path), 86400)
  if (error || !data) throw error ?? new Error('no urls')
  return data.map(d => d.signedUrl ?? '')
}
