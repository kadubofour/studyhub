import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { aiErrorResponse, runAiAction } from '@/lib/ai/run'
import { RESOURCES_COST, findResources } from '@/lib/ai/resources'

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

  const result = await runAiAction(
    client => findResources(client, { topic: topic.name as string, course }, request.signal).then(resources => ({ resources })),
    { userId: user.id, cost: RESOURCES_COST, signal: request.signal },
  )
  return result.ok ? NextResponse.json(result.value) : aiErrorResponse(result.error)
}
