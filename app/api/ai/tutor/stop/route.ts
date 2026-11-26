import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { stopRun } from '@/lib/ai/tutorRuns'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// POST { chatId } → { stopped }: ends the reply being written for the student's chat. What was written so far is saved by the reply's own request.
export async function POST(request: Request) {
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null) as { chatId?: unknown } | null
  if (typeof body?.chatId !== 'string' || !UUID.test(body.chatId)) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  return NextResponse.json({ stopped: stopRun(user.id, body.chatId) })
}
