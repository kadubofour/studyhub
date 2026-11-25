import 'server-only'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase/server'
import { readFile, type FileRow } from './tutorFiles'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const fail = (status: number, error: string) => ({ response: NextResponse.json({ error }, { status }) })

/** Whether the request names an uploaded file (a materialId) rather than a note */
export const namesFile = async (request: Request) => {
  const sent = (await request.clone().json().catch(() => null)) as { materialId?: unknown } | null
  return !!sent && 'materialId' in sent
}

// The start of an "AI from an uploaded file" route, like readOwnNote: signed in, a valid materialId, and the file read with the student's own
// session (row-level security means only their file). A file whose text has not been taken out yet is read now; one with no text in it
// (a scan or a photo) is too_short, as a note with nothing in it is.
export async function readOwnFile(request: Request): Promise<
  { sb: SupabaseClient; file: { id: string; title: string; content_md: string }; body: Record<string, unknown>; userId: string } | { response: Response }
> {
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return fail(401, 'unauthorized')
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const id = body?.materialId
  if (typeof id !== 'string' || !UUID.test(id)) return fail(400, 'bad_request')
  const { data } = await sb.from('materials').select('id,course_id,note_id,name,mime,path,bytes,body,body_status,created_at').eq('id', id).maybeSingle()
  if (!data) return fail(404, 'not_found')
  const row = data as FileRow & { body: string | null }
  let text = row.body ?? ''
  if (row.body_status === 'pending') {
    const got = await readFile(sb, row).catch(() => null)
    text = got?.body ?? ''
  }
  return { sb, file: { id: row.id, title: row.name, content_md: text }, body: body!, userId: user.id }
}
