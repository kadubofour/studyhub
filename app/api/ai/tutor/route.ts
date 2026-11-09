import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { aiErrorResponse, classifyAiError } from '@/lib/ai/run'
import { isAiConfigured, openai } from '@/lib/ai/openai'
import { releaseTutorMessage, reserveTutorMessage } from '@/lib/ai/tutorLimit'
import { streamTutor } from '@/lib/ai/tutor'
import { LESSON_STATE_MAX, buildContext, buildInput, tutorInstructions, type Material } from '@/lib/ai/tutorContext'
import { LESSON_STATE_TOOL, lessonStateTool, parseLessonState, parseToolCall, toolDefinitions, type Proposal } from '@/lib/ai/tutorTools'
import { courseNamed } from '@/lib/ai/courseNamed'
import { courseOutline } from '@/lib/ai/courseOutline'
import { courseMaterial } from '@/lib/ai/tutorCourse'
import { transcriptText } from '@/lib/ai/lectureNote'
import { evidence, weakSpots } from '@/lib/topics/status'
import type { TopicStat } from '@/lib/topics/types'
import type { TranscriptLine } from '@/lib/lectures/time'
import { ATTACH_LIMITS, checkAttachments, pagesOf, resendable, type Attachment } from '@/lib/tutor/attachments'
import { attachmentParts } from '@/lib/ai/tutorAttachments'
import { tutorFiles } from '@/lib/ai/tutorFiles'
import { countPdfPages } from '@/lib/import/pdfPages'

export const maxDuration = 120
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_MESSAGE = 4000
const bad = (status: number, error: string) => NextResponse.json({ error }, { status })

// The photos and PDFs among the attachments, fetched with the student's own session (so storage policies apply), base64 by path.
// A missing file is simply not in the map; a PDF's real page count replaces what the browser said. Fetching stops (over) as soon as
// the files would pass the byte budget, before reading or parsing the one that would.
async function fetchFiles(sb: Awaited<ReturnType<typeof createServerSupabase>>, list: Attachment[], budget: number) {
  const files = new Map<string, string>()
  const pages = new Map<string, number>()
  let bytes = 0
  for (const a of list) {
    if (a.kind === 'document' || files.has(a.path)) continue
    const { data } = await sb.storage.from('tutor-files').download(a.path)
    if (!data) continue
    if (bytes + data.size > budget) return { files, pages, bytes, over: true }
    const buf = Buffer.from(await data.arrayBuffer())
    bytes += buf.length
    if (a.kind === 'pdf') pages.set(a.path, await countPdfPages(buf))
    files.set(a.path, buf.toString('base64'))
  }
  return { files, pages, bytes, over: false }
}
const withPages = (list: Attachment[], pages: Map<string, number>): Attachment[] => list.map(a => (a.kind === 'pdf' ? { ...a, pages: pages.get(a.path) ?? a.pages } : a))
const named = (content: string, list: Attachment[]) => (list.length ? `${content}${content ? '\n' : ''}(Attached: ${list.map(a => a.name).join(', ')})` : content)

// POST { chatId, message, attachments? } → NDJSON: sources, then the reply as it is written, then done (with any
// proposals) or an error. Nothing the tutor proposes is saved here: the student approves in the browser.
export async function POST(request: Request) {
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return bad(401, 'unauthorized')
  const body = await request.json().catch(() => null) as { chatId?: unknown; message?: unknown; attachments?: unknown; voice?: unknown } | null
  const message = typeof body?.message === 'string' ? body.message.trim() : ''
  if (typeof body?.chatId !== 'string' || !UUID.test(body.chatId) || message.length > MAX_MESSAGE) return bad(400, 'bad_request')
  const attachments = checkAttachments(body.attachments, user.id, body.chatId)
  if (!attachments || (!message && !attachments.length)) return bad(400, 'bad_request')
  if (!isAiConfigured()) return aiErrorResponse('ai_unavailable')
  // Everything below is read with the student's own session: row-level security means only their data
  const { data: chat } = await sb.from('tutor_chats').select('id,title,course_id,note_id,lecture_id,guided').eq('id', body.chatId).maybeSingle()
  if (!chat) return bad(404, 'not_found')
  // Where a long lesson has got to; read apart from the chat, so a database without the column yet (a deploy ahead of its migration) only loses this
  const lessonState = ((await sb.from('tutor_chats').select('lesson_state').eq('id', chat.id).maybeSingle()).data as { lesson_state?: string | null } | null)?.lesson_state ?? null

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
  // The student's courses, read first: a message that names one ("teach me MATH 121") is about it, whichever course the chat was opened in
  const { data: courseRows } = await sb.from('courses').select('id,name')
  const allCourses = (courseRows ?? []) as { id: string; name: string }[]
  const asked = courseNamed(message, allCourses)
  courseId = asked?.id ?? courseId
  const aboutCourse = allCourses.find(c => c.id === courseId) ?? null
  // The message is counted before any file is read, so a stream of requests naming big files uses the student's allowance; refused, it is given back
  const reserved = await reserveTutorMessage(user.id)
  if (reserved !== 'ok') return aiErrorResponse(reserved)
  const refuse = async (status: number, error: string) => { await releaseTutorMessage(user.id); return bad(status, error) }
  // Files kept in the Library, read for the first time here if they need it, so the search below can find them
  const notebookIds = courseId ? ((await sb.from('notebooks').select('id').eq('course_id', courseId)).data ?? []).map(b => b.id as string) : []
  const kept = await tutorFiles(sb, { courseId, message, notebookIds })
  const course = courseId ? await courseMaterial(sb, courseId, notebookIds) : [] // read after the files above, so one read for the first time is in it
  const { data: past } = await sb.from('tutor_messages').select('role,content,attachments').eq('chat_id', chat.id).order('created_at', { ascending: false }).limit(12)
  // A follow-up such as "why?" says little by itself, so the student's last two questions are searched along with it
  const earlier = ((past ?? []) as { role: string; content: string }[]).filter(h => h.role === 'user').slice(0, 2).map(h => h.content.slice(0, 300))
  const sought = message || attachments.map(a => (a.kind === 'document' ? a.text.slice(0, 300) : a.name)).join(' ')
  const query = [sought, ...earlier].join(' ').slice(0, 1000)
  const [{ data: found }, { data: decks }, outline] = await Promise.all([
    sb.rpc('tutor_find_material', { p_query: query, p_limit: 8 }),
    sb.from('decks').select('id,name'),
    aboutCourse ? courseOutline(sb, aboutCourse) : Promise.resolve(''),
  ])
  const courses = allCourses
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
  const context = buildContext({ attached, matches, courses: courses ?? [], decks: decks ?? [], weak, named: kept.named, files: kept.list, outline, lessonState, course, query })
  // A question's stored attachments are checked again like a new message's: the student can write that column directly
  const past12 = ((past ?? []) as { role: 'user' | 'assistant'; content: string; attachments?: unknown }[]).reverse()
    .map(h => ({ role: h.role, content: h.content, attachments: h.role === 'user' ? checkAttachments(h.attachments, user.id, chat.id) ?? [] : [] }))
  const toolCtx = { courseIds: (courses ?? []).map(c => c.id as string), deckIds: (decks ?? []).map(d => d.id as string) }

  // This message's files must all be there, within the page limit and the size budget
  const fresh = await fetchFiles(sb, attachments, ATTACH_LIMITS.pdfBytes)
  if (fresh.over) return refuse(413, 'too_large')
  if (attachments.some(a => a.kind !== 'document' && !fresh.files.has(a.path))) return refuse(400, 'attachment_missing')
  const counted = withPages(attachments, fresh.pages)
  if (pagesOf(counted) > ATTACH_LIMITS.pages) return refuse(413, 'too_many_pages')
  // Earlier questions' files are read again, newest first, while they fit in what is left; a file sent again with this message is not read twice
  let pagesLeft = ATTACH_LIMITS.pages - pagesOf(counted)
  let bytesLeft = ATTACH_LIMITS.pdfBytes - fresh.bytes
  // A kept PDF with no text in it (a scan) goes to the model as it is, when it fits
  const scannedParts: ReturnType<typeof attachmentParts> = []
  const addScans = async (list: typeof kept.scanned) => {
    for (const f of list) {
      if (f.bytes > bytesLeft) continue
      const { data } = await sb.storage.from('materials').download(f.path)
      if (!data) continue
      const buf = Buffer.from(await data.arrayBuffer())
      const pages = await countPdfPages(buf)
      if (pages > pagesLeft || buf.length > bytesLeft) continue
      pagesLeft -= pages; bytesLeft -= buf.length
      scannedParts.push(...attachmentParts([{ kind: 'pdf', name: f.name, path: f.path, pages }], new Map([[f.path, buf.toString('base64')]])))
      context.sources.push({ kind: 'file', id: f.id, title: f.name })
    }
  }
  await addScans(kept.scanned)
  const resent = new Map<number, ReturnType<typeof attachmentParts>>()
  for (const i of resendable(past12, pagesOf(counted))) {
    const atts = past12[i].attachments.filter(a => a.kind === 'document' || !fresh.files.has(a.path))
    if (!atts.length) continue
    const got = await fetchFiles(sb, atts, bytesLeft)
    if (got.over) continue
    const recounted = withPages(atts, got.pages)
    if (pagesOf(recounted) > pagesLeft) continue
    pagesLeft -= pagesOf(recounted); bytesLeft -= got.bytes
    resent.set(i, attachmentParts(recounted, got.files))
  }
  await addScans(kept.courseScans) // the rest of the course's scans get the room what the student asked about and sent has left
  const history = past12.map((h, i) => ({ role: h.role, content: named(h.content, h.attachments), parts: resent.get(i) }))
  const saved = await sb.from('tutor_messages').insert({ chat_id: chat.id, user_id: user.id, role: 'user', content: message, attachments: counted }).select('id').single()
  if (saved.error) { await releaseTutorMessage(user.id); return aiErrorResponse('ai_failed') }

  const gen = streamTutor(openai(), {
    instructions: tutorInstructions(!!chat.note_id, !!chat.guided, body.voice === true), tools: [...toolDefinitions(), lessonStateTool(LESSON_STATE_MAX)], signal: request.signal,
    input: buildInput({ history, context: context.text, message, parts: [...attachmentParts(counted, fresh.files), ...scannedParts] }),
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
        // The tutor's own notes on the lesson are kept with the chat, not shown or approved; a failed save only means the next message has the old ones
        const stateCall = calls.filter(c => c.name === LESSON_STATE_TOOL).at(-1)
        const state = stateCall ? parseLessonState(stateCall.args, LESSON_STATE_MAX) : null
        if (state) await sb.from('tutor_chats').update({ lesson_state: state }).eq('id', chat.id).then(() => {}, () => {})
        const asks = calls.filter(c => c.name !== LESSON_STATE_TOOL)
        const proposals = asks.flatMap(c => parseToolCall(c.name, c.args, toolCtx, crypto.randomUUID()) ?? [])
        if (proposals.length < asks.length) {
          const note = `${reply ? '\n\n' : ''}_(I couldn't prepare ${asks.length - proposals.length === 1 ? 'one of the things' : 'some of the things'} you asked for.)_`
          reply += note; send({ t: 'delta', text: note })
        }
        if (!reply.trim() && !proposals.length) throw new Error('The AI sent back nothing.') // only its own lesson notes: nothing for the student to read
        const messageId = await saveReply(reply, proposals, 'ok')
        // Name the chat only if it still has its default name (a rename made while the reply was written wins); always touch it so it moves to the top
        if (chat.title === 'New chat') await sb.from('tutor_chats').update({ title: (message || counted[0]?.name || 'New chat').slice(0, 60) }).eq('id', chat.id).eq('title', 'New chat')
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
