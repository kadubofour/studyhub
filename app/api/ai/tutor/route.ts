import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { aiErrorResponse, classifyAiError } from '@/lib/ai/run'
import { isAiConfigured, openai } from '@/lib/ai/openai'
import { releaseTutorMessage, reserveTutorMessage } from '@/lib/ai/tutorLimit'
import { streamTutor } from '@/lib/ai/tutor'
import { buildContext, buildInput, tutorInstructions, type Material } from '@/lib/ai/tutorContext'
import { parseToolCall, toolDefinitions, type Proposal } from '@/lib/ai/tutorTools'
import { transcriptText } from '@/lib/ai/lectureNote'
import { evidence, weakSpots } from '@/lib/topics/status'
import type { TopicStat } from '@/lib/topics/types'
import type { TranscriptLine } from '@/lib/lectures/time'

export const maxDuration = 120
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_MESSAGE = 4000
const bad = (status: number, error: string) => NextResponse.json({ error }, { status })

// POST { chatId, message } → NDJSON: sources, then the reply as it is written, then done (with any
// proposals) or an error. Nothing the tutor proposes is saved here: the student approves in the browser.
export async function POST(request: Request) {
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return bad(401, 'unauthorized')
  const body = await request.json().catch(() => null) as { chatId?: unknown; message?: unknown } | null
  const message = typeof body?.message === 'string' ? body.message.trim() : ''
  if (typeof body?.chatId !== 'string' || !UUID.test(body.chatId) || !message || message.length > MAX_MESSAGE) return bad(400, 'bad_request')
  if (!isAiConfigured()) return aiErrorResponse('ai_unavailable')
  // Everything below is read with the student's own session: row-level security means only their data
  const { data: chat } = await sb.from('tutor_chats').select('id,title,course_id,note_id,lecture_id').eq('id', body.chatId).maybeSingle()
  if (!chat) return bad(404, 'not_found')

  let attached: Material | null = null
  // The course this chat is about: its own, else the attached note's or lecture's
  let courseId = (chat.course_id as string | null) ?? null
  if (chat.note_id) {
    const { data: n } = await sb.from('notes').select('id,title,content_md,course_id').eq('id', chat.note_id).maybeSingle()
    if (n) { attached = { kind: 'note', id: n.id, title: n.title, text: n.content_md }; courseId ??= (n.course_id as string | null) ?? null }
  } else if (chat.lecture_id) {
    const { data: l } = await sb.from('lectures').select('id,title,transcript,course_id').eq('id', chat.lecture_id).maybeSingle()
    if (l) { attached = { kind: 'lecture', id: l.id, title: l.title, text: transcriptText(l.transcript as TranscriptLine[]) }; courseId ??= (l.course_id as string | null) ?? null }
  }
  const [{ data: found }, { data: courses }, { data: decks }, { data: past }] = await Promise.all([
    sb.rpc('tutor_find_material', { p_query: message, p_limit: 5 }),
    sb.from('courses').select('id,name'),
    sb.from('decks').select('id,name'),
    sb.from('tutor_messages').select('role,content').eq('chat_id', chat.id).order('created_at', { ascending: false }).limit(12),
  ])
  const matches = ((found ?? []) as { kind: Material['kind']; id: string; title: string; snippet: string }[])
    .map(m => ({ kind: m.kind, id: m.id, title: m.title, text: m.snippet }))
  // The course's weak and stale topics, so the tutor can offer help when a question touches one; never fatal
  let weak: { name: string; detail: string }[] = []
  if (courseId) {
    try {
      const { data, error } = await sb.rpc('topic_stats', { p_course: courseId })
      if (!error && Array.isArray(data)) weak = weakSpots(data as TopicStat[], new Date()).map(s => ({ name: s.name, detail: evidence(s) }))
    } catch { /* the tutor works without it */ }
  }
  const context = buildContext({ attached, matches, courses: courses ?? [], decks: decks ?? [], weak })
  const history = ((past ?? []) as { role: 'user' | 'assistant'; content: string }[]).reverse()
  const toolCtx = { noteId: (chat.note_id as string | null) ?? null, courseIds: (courses ?? []).map(c => c.id as string), deckIds: (decks ?? []).map(d => d.id as string) }

  const reserved = await reserveTutorMessage(user.id)
  if (reserved !== 'ok') return aiErrorResponse(reserved)
  const saved = await sb.from('tutor_messages').insert({ chat_id: chat.id, user_id: user.id, role: 'user', content: message }).select('id').single()
  if (saved.error) { await releaseTutorMessage(user.id); return aiErrorResponse('ai_failed') }

  const gen = streamTutor(openai(), {
    instructions: tutorInstructions(!!chat.note_id), tools: toolDefinitions(!!chat.note_id), signal: request.signal,
    input: buildInput({ history, context: context.text, message }),
  })
  // Ask for the first piece now, so a model failure before any text is a proper error status
  let first: IteratorResult<{ type: 'delta'; text: string } | { type: 'tool'; name: string; args: string }>
  try { first = await gen.next() } catch (e) { await releaseTutorMessage(user.id); return aiErrorResponse(classifyAiError(e, request.signal)) }

  const enc = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: object) => { try { controller.enqueue(enc.encode(JSON.stringify(o) + '\n')) } catch { /* the reader left */ } }
      let reply = ''
      const calls: { name: string; args: string }[] = []
      const take = (r: typeof first) => {
        if (r.done) return
        if (r.value.type === 'delta') { reply += r.value.text; send({ t: 'delta', text: r.value.text }) } else calls.push(r.value)
      }
      const saveReply = async (content: string, proposals: Proposal[], status: 'ok' | 'cut_off') =>
        (await sb.from('tutor_messages').insert({ chat_id: chat.id, user_id: user.id, role: 'assistant', content, sources: context.sources, proposals, status }).select('id').single()).data?.id as string | undefined
      send({ t: 'sources', sources: context.sources })
      try {
        take(first)
        for (let r = first; !r.done; ) { r = await gen.next(); take(r) }
        const proposals = calls.flatMap(c => parseToolCall(c.name, c.args, toolCtx, crypto.randomUUID()) ?? [])
        if (proposals.length < calls.length) {
          const note = `${reply ? '\n\n' : ''}_(I couldn't prepare ${calls.length - proposals.length === 1 ? 'one of the things' : 'some of the things'} you asked for.)_`
          reply += note; send({ t: 'delta', text: note })
        }
        const messageId = await saveReply(reply, proposals, 'ok')
        // Name the chat only if it still has its default name (a rename made while the reply was written wins); always touch it so it moves to the top
        if (chat.title === 'New chat') await sb.from('tutor_chats').update({ title: message.slice(0, 60) }).eq('id', chat.id).eq('title', 'New chat')
        else await sb.from('tutor_chats').update({ updated_at: new Date().toISOString() }).eq('id', chat.id)
        send({ t: 'done', messageId, proposals })
      } catch (e) {
        const error = classifyAiError(e, request.signal)
        if (reply.trim()) send({ t: 'error', error, messageId: await saveReply(reply, [], 'cut_off') })
        else { await releaseTutorMessage(user.id); send({ t: 'error', error }) }
      } finally { try { controller.close() } catch { /* already closed */ } }
    },
  })
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' } })
}
