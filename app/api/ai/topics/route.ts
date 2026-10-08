import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { aiErrorResponse, runAiAction } from '@/lib/ai/run'
import { MAX_ITEMS, MIN_ITEM_CHARS, TOPICS_COST, draftTopics, type Item } from '@/lib/ai/topics'
import { removeSummary } from '@/lib/notes/summaryBlock'
import { transcriptText } from '@/lib/ai/lectureNote'
import type { TranscriptLine } from '@/lib/lectures/time'

export const maxDuration = 60
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// POST { courseId, mode: 'draft' | 'update' } → { topics: [{ name, notes: ids, lectures: ids }] }.
// Reads the course's material with the student's own session. It only drafts: the browser saves what the student approves.
export async function POST(request: Request) {
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null) as { courseId?: unknown; mode?: unknown } | null
  const courseId = typeof body?.courseId === 'string' && UUID.test(body.courseId) ? body.courseId : null
  const mode = body?.mode === 'draft' || body?.mode === 'update' ? body.mode : null
  if (!courseId || !mode) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  const { data: course } = await sb.from('courses').select('id').eq('id', courseId).maybeSingle()
  if (!course) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const [{ data: notes }, { data: lectures }, { data: topics }, { data: links }] = await Promise.all([
    sb.from('notes').select('id,title,content_md,updated_at').eq('course_id', courseId).order('updated_at', { ascending: false }).limit(MAX_ITEMS),
    sb.from('lectures').select('id,title,transcript,recorded_at').eq('course_id', courseId).order('recorded_at', { ascending: false }).limit(MAX_ITEMS),
    sb.from('topics').select('id,name').eq('course_id', courseId),
    sb.from('topic_links').select('note_id,lecture_id,topics!inner(course_id)').eq('topics.course_id', courseId),
  ])
  const linked = new Set((links ?? []).flatMap(l => [l.note_id, l.lecture_id].filter(Boolean) as string[]))
  const update = mode === 'update' && (topics ?? []).length > 0
  const all = [
    ...(notes ?? []).map(n => ({ at: n.updated_at as string, item: { kind: 'note', id: n.id, title: n.title, text: removeSummary(n.content_md as string) } as Item })),
    ...(lectures ?? []).map(l => ({ at: l.recorded_at as string, item: { kind: 'lecture', id: l.id, title: l.title, text: transcriptText(l.transcript as TranscriptLine[]) } as Item })),
  ].sort((a, b) => b.at.localeCompare(a.at)).map(x => x.item)
    .filter(i => i.text.trim().length >= MIN_ITEM_CHARS && (!update || !linked.has(i.id)))
  if (update ? all.length < 1 : all.length < 2) return NextResponse.json({ error: update ? 'nothing_new' : 'too_little' }, { status: 422 })

  const result = await runAiAction(
    client => draftTopics(client, { items: all, mode: update ? 'update' : 'draft', existing: topics ?? [] }, request.signal),
    { userId: user.id, cost: TOPICS_COST, signal: request.signal },
  )
  return result.ok ? NextResponse.json(result.value) : aiErrorResponse(result.error)
}
