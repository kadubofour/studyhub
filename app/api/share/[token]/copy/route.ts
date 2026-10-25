import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { IMAGE_BUCKET, imagePath, toToken, tokenFile } from '@/lib/notes/images'
import { isShareToken } from '@/lib/share/token'

const FAILS: Record<string, number> = { link_off: 410, rate_limited: 429, not_copyable: 400, not_signed_in: 401 }
const fail = (error: string, status: number) => NextResponse.json({ error }, { status })

// POST: copies what a share link shows into the signed-in student's own Studyhub, as them (copy_shared), then copies the
// pictures its notes use from the owner's folder into theirs with the server's key. A picture that is gone is skipped:
// the copy still succeeds. Returns { kind, id } of the new deck, note or notebook.
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  // Only this site's own page may ask, not a request another site made the browser send
  const site = request.headers.get('sec-fetch-site')
  if (site && site !== 'same-origin') return fail('forbidden', 403)
  const { token } = await params
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return fail('not_signed_in', 401)
  if (!isShareToken(token)) return fail('link_off', 410)

  const { data, error } = await sb.rpc('copy_shared', { p_token: token })
  if (error) {
    const code = Object.keys(FAILS).find(k => error.message?.includes(k))
    return code ? fail(code, FAILS[code]) : fail('copy_failed', 500)
  }
  const row = (Array.isArray(data) ? data[0] : data) as { kind?: string; id?: string } | undefined
  if (!row?.kind || !row.id) return fail('copy_failed', 500)

  if ((row.kind === 'note' || row.kind === 'notebook') && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const admin = adminClient()
      const files = await admin.rpc('shared_note_files', { p_token: token })
      for (const f of (files.data ?? []) as { owner_id: string; file: string }[]) {
        const file = tokenFile(toToken(f.file))
        if (!file || f.owner_id === user.id) continue // their own pictures are already in their folder
        // a missing picture (or one already copied before) comes back as an error, which is skipped
        try { await admin.storage.from(IMAGE_BUCKET).copy(imagePath(f.owner_id, file), imagePath(user.id, file)) } catch { /* skipped */ }
      }
    } catch { /* the copy is made; a picture that could not be copied shows its description */ }
  }
  return NextResponse.json({ kind: row.kind, id: row.id })
}
