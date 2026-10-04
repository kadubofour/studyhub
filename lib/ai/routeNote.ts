import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase/server'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const fail = (status: number, error: string) => ({ response: NextResponse.json({ error }, { status }) })

// Shared start of every "AI from a note" route: signed in, a valid noteId, and the note read
// with the student's own session (row-level security means it can only be their note).
export async function readOwnNote(request: Request): Promise<
  { sb: SupabaseClient; note: { id: string; title: string; content_md: string }; body: Record<string, unknown>; userId: string } | { response: Response }
> {
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return fail(401, 'unauthorized')
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const noteId = body?.noteId
  if (typeof noteId !== 'string' || !UUID.test(noteId)) return fail(400, 'bad_request')
  const { data: note } = await sb.from('notes').select('id,title,content_md').eq('id', noteId).maybeSingle()
  if (!note) return fail(404, 'not_found')
  return { sb, note, body: body!, userId: user.id }
}
