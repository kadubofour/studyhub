import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { aiErrorResponse, runAiAction } from '@/lib/ai/run'
import { RESOURCES_COST, findResources } from '@/lib/ai/resources'
import { searchVideos } from '@/lib/youtube'
import { youtubeId } from '@/lib/resources/clean'

export const maxDuration = 120
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// POST { topicId } → { resources: [{ url, title, kind }] }. Searches the web for the student's own topic;
// only the topic and course names go out. It only finds: the browser saves what comes back.
export async function POST(request: Request) {
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null) as { topicId?: unknown } | null
  const topicId = typeof body?.topicId === 'string' && UUID.test(body.topicId) ? body.topicId : null
  if (!topicId) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  const { data: topic } = await sb.from('topics').select('id,name,courses(name)').eq('id', topicId).maybeSingle()
  if (!topic) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const course = (topic.courses as unknown as { name?: string } | null)?.name ?? ''

  // Videos come from YouTube when a key is set; otherwise from the web search
  const key = process.env.YOUTUBE_API_KEY
  // A custom address is only for the E2E stand-in, so the key can never be sent to another host
  const base = process.env.E2E_FAKE_AI === '1' && process.env.NODE_ENV !== 'production' ? process.env.YOUTUBE_API_BASE : undefined
  const search = key ? (q: string) => searchVideos(q, { key, base, signal: request.signal }) : undefined
  // Videos already saved for this topic are not offered again
  const { data: saved } = await sb.from('topic_resources').select('url').eq('topic_id', topicId)
  const exclude = ((saved ?? []) as { url: string }[]).map(r => youtubeId(r.url)).filter((id): id is string => !!id)

  const result = await runAiAction(
    client => findResources(client, { topic: topic.name as string, course, exclude }, request.signal, search).then(resources => ({ resources })),
    { userId: user.id, cost: RESOURCES_COST, signal: request.signal },
  )
  return result.ok ? NextResponse.json(result.value) : aiErrorResponse(result.error)
}
